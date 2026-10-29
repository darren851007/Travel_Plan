/* ============================================================
   國家、城市、機場資料（Cloudflare D1）
   - 每月更新：排程（wrangler.toml 的 crons）每分鐘呼叫 syncStep 一次
     這個月還沒更新的話：先更新國家清單，之後每次更新一個國家的城市與機場（人口多的國家先）
     全部更新完，這個月剩下的排程什麼都不做；免費方案每次執行的時間很短，所以分批
   - 網頁查詢（server/api/places.js）只用 SQL 讀這裡，不呼叫外部 API；
     唯一的例外：某個國家還從來沒抓過（例如剛部署好、排程還沒輪到），第一次有人選它時當場抓一次
   外部資料來源：lib/geonames.js
   ============================================================ */
import { fetchAirports, fetchCities, fetchCountries } from "../lib/geonames.js";

export const thisMonth = () => new Date().toISOString().slice(0, 7);

/* D1 一個查詢最多 100 個參數：大量寫入時把值直接寫進 SQL（數字檢查過、字串跳脫單引號） */
const sqlText = (v) => `'${String(v ?? "").replace(/\u0000/g, "").replace(/'/g, "''")}'`;
const sqlNum = (v) => (Number.isFinite(v) ? String(v) : "0");
const ROWS_PER_INSERT = 200;

function inserts(table, columns, rows) {
  const out = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
    const values = rows
      .slice(i, i + ROWS_PER_INSERT)
      .map((row) => `(${columns.map(([name, kind]) => (kind === "num" ? sqlNum(row[name]) : sqlText(row[name]))).join(",")})`)
      .join(",");
    out.push(`INSERT OR REPLACE INTO ${table} (${columns.map(([name]) => name).join(",")}) VALUES ${values}`);
  }
  return out;
}

const CITY_COLUMNS = [["id", "num"], ["country"], ["name_zh"], ["name_en"], ["admin"], ["lat", "num"], ["lon", "num"], ["population", "num"]];
const AIRPORT_COLUMNS = [["iata"], ["country"], ["name_zh"], ["name_en"], ["lat", "num"], ["lon", "num"]];

/* 寫入國家清單的 SQL（保留每個國家的 synced_month）；排程與 scripts/load-places.mjs 共用 */
export function countriesSql(rows, month = thisMonth()) {
  const out = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
    const values = rows
      .slice(i, i + ROWS_PER_INSERT)
      .map((c) => `(${sqlText(c.code)},${sqlText(c.name_zh)},${sqlText(c.name_en)},${sqlNum(c.population)})`)
      .join(",");
    out.push(
      `INSERT INTO countries (code, name_zh, name_en, population) VALUES ${values} ` +
        `ON CONFLICT(code) DO UPDATE SET name_zh = excluded.name_zh, name_en = excluded.name_en, population = excluded.population`
    );
  }
  out.push(`INSERT OR REPLACE INTO sync_state (key, value) VALUES ('countries_month', ${sqlText(month)})`);
  return out;
}

/* 換掉一個國家的城市與機場的 SQL */
export function countrySql(code, cities, airports, month = thisMonth()) {
  return [
    `DELETE FROM cities WHERE country = ${sqlText(code)}`,
    ...inserts("cities", CITY_COLUMNS, cities),
    `DELETE FROM airports WHERE country = ${sqlText(code)}`,
    ...inserts("airports", AIRPORT_COLUMNS, airports),
    `UPDATE countries SET synced_month = ${sqlText(month)} WHERE code = ${sqlText(code)}`,
  ];
}

export async function syncCountries(env) {
  const db = env.PLACES_DB;
  const rows = await fetchCountries(env);
  await db.batch(countriesSql(rows).map((sql) => db.prepare(sql)));
  return rows.length;
}

/* 一個國家的城市與機場：整批換掉（D1 的 batch 是同一個交易，不會只換一半） */
export async function syncCountry(env, code) {
  if (!/^[A-Z]{2}$/.test(code)) throw new Error("國家代碼不對");
  const db = env.PLACES_DB;
  const [cities, airports] = await Promise.all([fetchCities(env, code), fetchAirports(env, code)]);
  await db.batch(countrySql(code, cities, airports).map((sql) => db.prepare(sql)));
  return { cities: cities.length, airports: airports.length };
}

/* 排程每次做一小步；回傳做了什麼（記錄用） */
export async function syncStep(env) {
  if (!env.PLACES_DB || !env.GEONAMES_USERNAME) return "skip: not configured";
  const db = env.PLACES_DB;
  const month = thisMonth();
  const countriesMonth = await db.prepare("SELECT value FROM sync_state WHERE key = 'countries_month'").first("value");
  if (countriesMonth !== month) return `countries: ${await syncCountries(env)}`;

  const next = await db
    .prepare("SELECT code FROM countries WHERE synced_month IS NULL OR synced_month <> ? ORDER BY population DESC LIMIT 1")
    .bind(month)
    .first("code");
  if (!next) return "done";
  const result = await syncCountry(env, next);
  return `${next}: ${result.cities} cities, ${result.airports} airports`;
}

/* ---------- 網頁查詢（只讀 D1） ---------- */

/* LIKE 的 % 與 _ 要跳脫，使用者打的字才會被當成一般文字 */
const like = (q) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function listCountries(env, q = "") {
  const db = env.PLACES_DB;
  /* 剛部署、國家清單還是空的：當場抓一次 */
  if (!(await db.prepare("SELECT 1 FROM countries LIMIT 1").first())) await syncCountries(env);
  const query = q.trim().slice(0, 50);
  const { results } = query
    ? await db
        .prepare(
          `SELECT code, name_zh, name_en FROM countries
           WHERE name_zh LIKE ?1 ESCAPE '\\' OR name_en LIKE ?1 ESCAPE '\\' OR code = upper(?2)
           ORDER BY population DESC LIMIT 300`
        )
        .bind(like(query), query)
        .all()
    : await db.prepare("SELECT code, name_zh, name_en FROM countries ORDER BY population DESC LIMIT 300").all();
  return results;
}

/* 兩點距離（公里） */
function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/* 在某國搜尋城市（依人口排序），每個城市附上最近的機場 */
export async function searchCities(env, country, q = "", limit = 20) {
  const db = env.PLACES_DB;
  const row = await db.prepare("SELECT synced_month FROM countries WHERE code = ?").bind(country).first();
  if (!row) return null;
  /* 這個國家還沒抓過（排程還沒輪到）：當場抓一次 */
  if (!row.synced_month) await syncCountry(env, country);

  const query = q.trim().slice(0, 50);
  const [{ results: cities }, { results: airports }] = await Promise.all([
    query
      ? db
          .prepare(
            `SELECT id, name_zh, name_en, admin, lat, lon, population FROM cities
             WHERE country = ?1 AND (name_zh LIKE ?2 ESCAPE '\\' OR name_en LIKE ?2 ESCAPE '\\')
             ORDER BY population DESC LIMIT ?3`
          )
          .bind(country, like(query), limit)
          .all()
      : db
          .prepare("SELECT id, name_zh, name_en, admin, lat, lon, population FROM cities WHERE country = ?1 ORDER BY population DESC LIMIT ?2")
          .bind(country, limit)
          .all(),
    db.prepare("SELECT iata, name_zh, name_en, lat, lon FROM airports WHERE country = ?").bind(country).all(),
  ]);

  /* 出國通常飛國際機場：國際機場的距離打對折再比（京都 → 關西 KIX，而不是只飛國內線的伊丹 ITM） */
  const international = (a) => /國際|International/i.test(`${a.name_zh} ${a.name_en}`);
  return cities.map((city) => {
    let best = null;
    for (const a of airports) {
      const km = distanceKm(city, a);
      const score = international(a) ? km / 2 : km;
      if (!best || score < best.score) best = { iata: a.iata, name: a.name_zh, km, score };
    }
    return { ...city, airport: best ? { iata: best.iata, name: best.name, km: Math.round(best.km) } : null };
  });
}
