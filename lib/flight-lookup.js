/* ============================================================
   查詢真實航班（AeroDataBox，經 RapidAPI）：用航班號碼與日期查機型、航廈、起降時間
   金鑰放在 Worker 的 AERODATABOX_KEY（npx wrangler secret put AERODATABOX_KEY）
   ============================================================ */
const HOST = "aerodatabox.p.rapidapi.com";

export class LookupError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function cleanQuery({ number, date, from } = {}) {
  const n = String(number || "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(n)) throw new LookupError(400, "航班號碼格式不對，例如 BR160");
  const d = String(date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new LookupError(400, "日期格式不對");
  const f = String(from || "").toUpperCase();
  return { number: n, date: d, from: /^[A-Z]{3}$/.test(f) ? f : "" };
}

/* "2026-12-18 08:20+08:00" → "08:20" */
const hhmm = (t) => (t?.local || "").slice(11, 16);

function duration(dep, arr) {
  const a = Date.parse((dep?.utc || "").replace(" ", "T").replace(/Z?$/, "Z"));
  const b = Date.parse((arr?.utc || "").replace(" ", "T").replace(/Z?$/, "Z"));
  if (!a || !b || b <= a) return "";
  const m = Math.round((b - a) / 60000);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/* 同一個航班號碼可能有多段（或共掛班號）：優先選出發機場相符、不是共掛的那一段 */
export function pickFlight(list, from) {
  if (!Array.isArray(list) || !list.length) return null;
  const score = (f) =>
    (from && f.departure?.airport?.iata === from ? 2 : 0) + (f.codeshareStatus === "IsCodeshared" ? 0 : 1);
  return [...list].sort((a, b) => score(b) - score(a))[0];
}

/* 轉成網頁航班表單用的欄位（只回傳查得到的） */
export function toFlightFields(f) {
  if (!f) return null;
  const point = (p) => ({
    code: p?.airport?.iata || "",
    city: p?.airport?.municipalityName || "",
    time: hhmm(p?.scheduledTime),
    terminal: p?.terminal ? `T${String(p.terminal).replace(/^T/i, "")}` : "",
  });
  return {
    number: (f.number || "").replace(/\s+/g, ""),
    airline: f.airline?.name || "",
    aircraft: f.aircraft?.model || "",
    from: point(f.departure),
    to: point(f.arrival),
    duration: duration(f.departure?.scheduledTime, f.arrival?.scheduledTime),
  };
}

export async function lookupFlight(key, query) {
  const url = `https://${HOST}/flights/number/${encodeURIComponent(query.number)}/${query.date}?withAircraftImage=false&withLocation=false`;
  const res = await fetch(url, { headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": HOST } });
  if (res.status === 204 || res.status === 404) return null;
  if (res.status === 429) throw new LookupError(429, "本月航班查詢次數已用完，請手動填寫");
  if (res.status === 401 || res.status === 403) throw new LookupError(503, "航班查詢服務的金鑰無效或未訂閱");
  if (!res.ok) throw new LookupError(502, `航班查詢服務暫時無法使用（${res.status}）`);
  const list = await res.json().catch(() => null);
  return toFlightFields(pickFlight(list, query.from));
}
