/* ============================================================
   一次載入所有國家的城市與機場到 Cloudflare D1（第一次建立、或想立刻全部更新時用）
   平常不用執行：部署後排程（server/places.js）每月會自己分批更新
   執行：node scripts/load-places.mjs            （寫到 Cloudflare 上的 D1）
        node scripts/load-places.mjs --local    （寫到本機測試用的 D1）
   GeoNames 使用者名稱讀 .dev.vars 的 GEONAMES_USERNAME（或環境變數）
   這個月已經載入過的國家會跳過，所以中斷（例如 GeoNames 每小時額度用完）後重新執行就會接著做
   ============================================================ */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchAirports, fetchCities, fetchCountries, GeoNamesError } from "../lib/geonames.js";
import { countriesSql, countrySql, thisMonth } from "../server/places.js";

const ROOT = new URL("..", import.meta.url).pathname;
const local = process.argv.includes("--local");
const extra = process.argv.filter((a) => a.startsWith("--persist-to="));
const COUNTRIES_PER_FILE = 10;

/* .dev.vars 只讀需要的那一個值 */
function readVar(name) {
  if (process.env[name]) return process.env[name];
  const file = join(ROOT, ".dev.vars");
  if (!existsSync(file)) return "";
  const line = readFileSync(file, "utf8").split("\n").find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}

const env = { GEONAMES_USERNAME: readVar("GEONAMES_USERNAME"), GEONAMES_BASE: readVar("GEONAMES_BASE") || undefined };
if (!env.GEONAMES_USERNAME) {
  console.error("請在 .dev.vars 加上 GEONAMES_USERNAME=你的 GeoNames 使用者名稱");
  process.exit(1);
}

const wrangler = (args) =>
  execFileSync("npx", ["wrangler", "d1", ...args, local ? "--local" : "--remote", ...extra], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const query = (sql) => JSON.parse(wrangler(["execute", "travel-places", "--json", `--command=${sql}`]))[0].results;

const dir = mkdtempSync(join(tmpdir(), "places-"));
function run(statements) {
  const file = join(dir, "batch.sql");
  writeFileSync(file, statements.map((s) => `${s};`).join("\n"));
  wrangler(["execute", "travel-places", `--file=${file}`, "--yes"]);
}

const month = thisMonth();
try {
  const countries = await fetchCountries(env);
  run(countriesSql(countries, month));
  console.log(`國家：${countries.length} 個`);

  const done = new Set(query(`SELECT code FROM countries WHERE synced_month = '${month}'`).map((r) => r.code));
  const todo = countries.filter((c) => !done.has(c.code)).sort((a, b) => b.population - a.population);
  console.log(`這個月已載入 ${done.size} 個國家，還有 ${todo.length} 個`);

  let totals = { cities: 0, airports: 0 };
  for (let i = 0; i < todo.length; i += COUNTRIES_PER_FILE) {
    const group = todo.slice(i, i + COUNTRIES_PER_FILE);
    const statements = [];
    for (const c of group) {
      const [cities, airports] = await Promise.all([fetchCities(env, c.code), fetchAirports(env, c.code)]);
      statements.push(...countrySql(c.code, cities, airports, month));
      totals.cities += cities.length;
      totals.airports += airports.length;
      console.log(`  ${c.code} ${c.name_zh}：${cities.length} 個城市、${airports.length} 個機場`);
    }
    run(statements);
    console.log(`已寫入 ${Math.min(i + COUNTRIES_PER_FILE, todo.length)} / ${todo.length}`);
  }
  console.log(`完成：這次載入 ${totals.cities} 個城市、${totals.airports} 個機場`);
} catch (err) {
  if (err instanceof GeoNamesError) {
    console.error(`GeoNames：${err.message}`);
    console.error("已經寫入的國家不會不見；等額度恢復後再執行一次就會接著做");
  } else {
    console.error(err.stderr || err.message);
  }
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
