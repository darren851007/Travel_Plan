/* ============================================================
   GeoNames（國家、城市、機場的公開資料）：只有每月更新地點資料時才呼叫（server/places.js）
   使用者名稱放在 Worker 的 GEONAMES_USERNAME（npx wrangler secret put GEONAMES_USERNAME）
   城市、機場名稱用繁體中文（lang=zh-Hant）；沒有中文名稱的地方會是英文
   國家名稱 GeoNames 沒有中文，改用內建的 Intl.DisplayNames（JP → 日本）
   GEONAMES_BASE 只給本機測試換成假的伺服器用
   ============================================================ */
const BASE = "https://secure.geonames.org";
const LANG = "zh-Hant";

export class GeoNamesError extends Error {}

async function call(env, path, params) {
  if (!env.GEONAMES_USERNAME) throw new GeoNamesError("網站尚未設定 GeoNames");
  const url = new URL(path, env.GEONAMES_BASE || BASE);
  for (const [k, v] of Object.entries({ ...params, username: env.GEONAMES_USERNAME })) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  /* GeoNames 出錯時 HTTP 也可能是 200，錯誤放在 status 裡（例如額度用完） */
  if (!res.ok || data.status) throw new GeoNamesError(data.status?.message || `GeoNames 錯誤（${res.status}）`);
  return data;
}

const text = (v, max = 100) => String(v ?? "").trim().slice(0, max);

/* 國家的繁體中文名稱（Cloudflare 與瀏覽器都內建）；查不到回傳空字串 */
const regionNames = new Intl.DisplayNames(["zh-Hant-TW"], { type: "region" });
export function countryNameZh(code) {
  try {
    const name = regionNames.of(code);
    return name && name !== code ? name : "";
  } catch {
    return "";
  }
}
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/* 所有國家：繁中名稱與英文名稱各查一次 */
export async function fetchCountries(env) {
  const [zh, en] = await Promise.all([
    call(env, "/countryInfoJSON", { lang: LANG }),
    call(env, "/countryInfoJSON", { lang: "en" }),
  ]);
  const english = new Map((en.geonames || []).map((c) => [c.countryCode, c.countryName]));
  return (zh.geonames || [])
    .filter((c) => /^[A-Z]{2}$/.test(c.countryCode || ""))
    .map((c) => ({
      code: c.countryCode,
      name_zh: countryNameZh(c.countryCode) || text(c.countryName) || text(english.get(c.countryCode)) || c.countryCode,
      name_en: text(english.get(c.countryCode)) || text(c.countryName) || c.countryCode,
      population: num(c.population),
    }));
}

/* 一個國家的城市：人口一萬五千以上，依人口排序，最多 1000 個 */
export async function fetchCities(env, country) {
  const data = await call(env, "/searchJSON", {
    country,
    featureClass: "P",
    cities: "cities15000",
    orderby: "population",
    maxRows: 1000,
    lang: LANG,
  });
  return (data.geonames || [])
    .filter((c) => c.geonameId && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng)))
    .map((c) => ({
      id: Number(c.geonameId),
      country,
      name_zh: text(c.name) || text(c.toponymName),
      name_en: text(c.toponymName) || text(c.name),
      admin: text(c.adminName1),
      lat: Number(c.lat),
      lon: Number(c.lng),
      population: num(c.population),
    }));
}

/* 一個國家的機場：只留有 IATA 代碼的（代碼在 alternateNames 裡，lang 是 iata） */
export async function fetchAirports(env, country) {
  const data = await call(env, "/searchJSON", {
    country,
    featureCode: "AIRP",
    style: "FULL",
    maxRows: 1000,
    lang: LANG,
  });
  const seen = new Set();
  const list = [];
  for (const a of data.geonames || []) {
    const iata = (a.alternateNames || []).find((n) => n.lang === "iata")?.name?.toUpperCase();
    if (!/^[A-Z]{3}$/.test(iata || "") || seen.has(iata)) continue;
    if (!Number.isFinite(Number(a.lat)) || !Number.isFinite(Number(a.lng))) continue;
    seen.add(iata);
    list.push({
      iata,
      country,
      name_zh: text(a.name) || text(a.toponymName),
      name_en: text(a.toponymName) || text(a.name),
      lat: Number(a.lat),
      lon: Number(a.lng),
    });
  }
  return list;
}
