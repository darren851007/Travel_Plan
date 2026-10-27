/* POST /api/flights/lookup — 用航班號碼與日期查真實航班（機型、航廈、起降時間）
   同一航班與日期的結果快取 12 小時，省下查詢次數 */
import { json, errorJson, checkPost, readBody } from "../../lib/http.js";
import { cleanQuery, lookupFlight, LookupError } from "../../lib/flight-lookup.js";

const CACHE_SECONDS = 12 * 60 * 60;

export async function lookup({ request, env, ctx }) {
  if (!env.AERODATABOX_KEY) return errorJson("網站尚未設定航班查詢", 503);
  const blocked = checkPost(request);
  if (blocked) return blocked;

  try {
    const query = cleanQuery(await readBody(request));
    const cacheKey = new Request(`https://flight-cache.internal/${query.number}/${query.date}/${query.from}`);
    const cache = caches.default;
    const hit = await cache.match(cacheKey);
    if (hit) return json(await hit.json());

    const flight = await lookupFlight(env.AERODATABOX_KEY, query);
    const result = { flight };
    ctx?.waitUntil?.(
      cache.put(cacheKey, new Response(JSON.stringify(result), { headers: { "Cache-Control": `max-age=${CACHE_SECONDS}` } }))
    );
    return json(result);
  } catch (err) {
    if (err instanceof LookupError || err.status) return errorJson(err.message, err.status || 400);
    return errorJson("航班查詢失敗，請稍後再試", 502);
  }
}
