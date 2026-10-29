/* ============================================================
   國家與城市（新增行程時的搜尋選單）：只用 SQL 查 D1（server/places.js），不呼叫外部 API
   GET /api/places/countries?q=日          所有國家（有 q 就篩選）
   GET /api/places/cities?country=JP&q=京  某國的城市（依人口排序，附最近的機場）
   ============================================================ */
import { errorJson, json } from "../../lib/http.js";
import { listCountries, searchCities } from "../places.js";

/* 資料一個月才更新一次：瀏覽器可以快取一小時 */
const CACHE = { "Cache-Control": "public, max-age=3600" };

function ready(env) {
  if (!env.PLACES_DB) return errorJson("網站尚未開啟國家與城市資料", 503);
  return null;
}

export async function countries({ request, env }) {
  const blocked = ready(env);
  if (blocked) return blocked;
  try {
    const q = new URL(request.url).searchParams.get("q") || "";
    return withCache(json({ countries: await listCountries(env, q) }));
  } catch (err) {
    console.error("places/countries", err);
    return errorJson("讀不到國家清單，請稍後再試", 502);
  }
}

export async function cities({ request, env }) {
  const blocked = ready(env);
  if (blocked) return blocked;
  const params = new URL(request.url).searchParams;
  const country = (params.get("country") || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) return errorJson("請先選國家", 400);
  try {
    const list = await searchCities(env, country, params.get("q") || "");
    if (!list) return errorJson("找不到這個國家", 404);
    return withCache(json({ cities: list }));
  } catch (err) {
    console.error("places/cities", err);
    return errorJson("讀不到城市清單，請稍後再試", 502);
  }
}

function withCache(res) {
  res.headers.set("Cache-Control", CACHE["Cache-Control"]);
  return res;
}
