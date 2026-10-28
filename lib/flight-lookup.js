/* ============================================================
   查詢真實航班（AeroDataBox）：用航班號碼與日期查機型、航廈、起降時間
   金鑰放在 Worker 的 AERODATABOX_KEY（npx wrangler secret put AERODATABOX_KEY）
   AeroDataBox 有三個申請管道，金鑰各自不同：
   - 官網直接申請（api.aerodatabox.com）、API.Market、RapidAPI
   可用 AERODATABOX_GATEWAY（direct / apimarket / rapidapi）指定；沒指定時依金鑰格式猜，猜錯會自動換下一個
   ============================================================ */
const GATEWAYS = {
  direct: { base: "https://api.aerodatabox.com", headers: (key) => ({ "X-Api-Key": key }) },
  apimarket: { base: "https://prod.api.market/api/v1/aedbx/aerodatabox", headers: (key) => ({ "x-api-market-key": key }) },
  rapidapi: {
    base: "https://aerodatabox.p.rapidapi.com",
    headers: (key) => ({ "X-RapidAPI-Key": key, "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com" }),
  },
};

/* 試的順序：指定的管道優先；RapidAPI 的金鑰裡有「msh」「jsn」 */
export function gatewayOrder(key, preferred) {
  const guess = /msh.*jsn/.test(key) ? "rapidapi" : "direct";
  const first = GATEWAYS[preferred] ? preferred : guess;
  return [first, ...Object.keys(GATEWAYS).filter((g) => g !== first)];
}

/* 記住這個 Worker 上哪個管道可以用，下次直接用 */
let working = null;

export class LookupError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function cleanQuery({ number, date, from, nearest } = {}) {
  const n = String(number || "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(n)) throw new LookupError(400, "航班號碼格式不對，例如 BR160");
  const d = String(date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new LookupError(400, "日期格式不對");
  const f = String(from || "").toUpperCase();
  return { number: n, date: d, from: /^[A-Z]{3}$/.test(f) ? f : "", nearest: nearest === true };
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
    date: (f.departure?.scheduledTime?.local || "").slice(0, 10),
    number: (f.number || "").replace(/\s+/g, ""),
    airline: f.airline?.name || "",
    aircraft: f.aircraft?.model || "",
    from: point(f.departure),
    to: point(f.arrival),
    duration: duration(f.departure?.scheduledTime, f.arrival?.scheduledTime),
  };
}

/* 查一個航班：用航班號碼與日期查那一天的班次
   nearest＝true 時改查最近一班（那天查不到、使用者選擇帶入最近一班時才用），結果標記 nearest */
export async function lookupFlight(key, query, preferred) {
  const number = encodeURIComponent(query.number);
  if (!query.nearest) return request(key, `/flights/number/${number}/${query.date}`, query, preferred);
  const nearest = await request(key, `/flights/number/${number}`, query, preferred);
  return nearest ? { ...nearest, nearest: true } : null;
}

async function request(key, route, query, preferred) {
  const path = `${route}?withAircraftImage=false&withLocation=false`;
  const order = working ? [working] : gatewayOrder(key, preferred);
  const refused = [];
  for (const name of order) {
    const gateway = GATEWAYS[name];
    const res = await fetch(gateway.base + path, { headers: gateway.headers(key) });
    /* 失敗時把對方的訊息記在 Worker 記錄（npx wrangler tail），方便查原因；不含金鑰 */
    if (!res.ok) console.warn("flight-lookup", name, res.status, (await res.clone().text()).slice(0, 300));
    /* 金鑰不屬於這個管道（或這個管道沒訂閱／沒額度）：換下一個試
       API.Market 金鑰錯誤時回 400 */
    if (res.status === 401 || res.status === 402 || res.status === 403 || (res.status === 400 && name === "apimarket")) {
      refused.push(`${name} ${res.status}`);
      continue;
    }
    working = name;
    if (res.status === 204 || res.status === 404) return null;
    if (res.status === 429) throw new LookupError(429, "本月航班查詢次數已用完，請手動填寫");
    if (!res.ok) throw new LookupError(502, `航班查詢服務暫時無法使用（${res.status}）`);
    const list = await res.json().catch(() => null);
    /* 不指定日期時，回傳的是單一航班或清單 */
    return toFlightFields(pickFlight(Array.isArray(list) ? list : list ? [list] : [], query.from));
  }
  working = null;
  const unpaid = refused.some((r) => r.endsWith("402"));
  throw new LookupError(
    503,
    unpaid ? "航班查詢的額度已用完或方案沒有額度，請手動填寫" : "航班查詢服務的金鑰無效或未訂閱，請手動填寫"
  );
}

/* 測試用：清掉記住的管道 */
export const resetGateway = () => {
  working = null;
};
