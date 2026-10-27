/* ============================================================
   Notion 核心：表單設計、讀寫欄位、建立國家頁面、轉成網頁行程
   只用 fetch，不依賴 Node，Cloudflare Functions 與本機測試都能用

   Notion 結構：使用者選的上層頁面（例如 Travel）
     └ 每個國家一個子頁面（韓國、日本…），裡面放 5 張表：
        旅程設定、航班、行程、住宿、準備清單
   ============================================================ */
import { CITIES, COUNTRIES, cityOption, findCity } from "./cities.js";

const NOTION_VERSION = "2022-06-28";

/* ---------- 表單設計 ---------- */

export const TABLES = {
  settings:  { title: "旅程設定", icon: "⚙️" },
  flights:   { title: "航班",     icon: "✈️" },
  itinerary: { title: "行程",     icon: "🗓️", required: true },
  lodging:   { title: "住宿",     icon: "🏨" },
  checklist: { title: "準備清單", icon: "✅" },
};

/* 「插圖」選項 → js/core/art.js 裡的首頁插圖 */
const ART_OPTIONS = { 首爾: "heroSeoul", 釜山: "heroBusan", 東京: "heroTokyo", 通用: "heroGeneric" };

/* 網頁標籤顏色 → Notion 選項顏色 */
const TONE_COLORS = {
  rose: "pink", lilac: "purple", sky: "blue", green: "green",
  butter: "yellow", peach: "orange", mint: "gray", sand: "brown",
};

function schemas(config) {
  const text = { rich_text: {} };
  const city = { select: { options: CITIES.map(cityOption) } };

  return {
    settings: {
      名稱: { title: {} },
      副標: text,
      出發日: { date: {} },
      插圖: { select: { options: Object.keys(ART_OPTIONS).map((name) => ({ name })) } },
      代號: text,
      排序: { number: {} },
    },
    flights: {
      航班: { title: {} },
      類型: { select: { options: [{ name: "去程", color: "orange" }, { name: "回程", color: "blue" }] } },
      航空公司: text,
      出發機場: text,
      出發城市: text,
      出發時間: text,
      出發航廈: text,
      抵達機場: text,
      抵達城市: text,
      抵達時間: text,
      抵達航廈: text,
      飛行時間: text,
      座位: text,
      旅客: text,
      行李: text,
    },
    itinerary: {
      名稱: { title: {} },
      第幾天: { number: {} },
      城市: city,
      當日主題: text,
      時間: text,
      說明: text,
      交通: {
        multi_select: {
          options: Object.values(config.transports).map((t) => ({
            name: t.label,
            color: TONE_COLORS[t.tone] || "default",
          })),
        },
      },
      必去: { checkbox: {} },
    },
    lodging: {
      名稱: { title: {} },
      城市: city,
      地址: text,
      房型: text,
      入住時間: text,
      退房時間: text,
      訂房編號: text,
      電話: { phone_number: {} },
      地圖搜尋: text,
    },
    checklist: {
      項目: { title: {} },
      說明: text,
      排序: { number: {} },
    },
  };
}

/* ---------- 小工具 ---------- */

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 接受 Notion 網址或 ID，取出 32 碼 ID */
export function toNotionId(value) {
  const match = String(value || "").replace(/-/g, "").match(/[0-9a-f]{32}(?=[^0-9a-f]*$)/i);
  if (!match) throw new NotionError(400, `看不懂這個 Notion 網址或 ID：${value}`);
  return match[0].toLowerCase();
}

export const plainId = (id) => id.replace(/-/g, "");

/* 比對標題時忽略表情符號與空白：「✈️ 航班」＝「航班」 */
const plainTitle = (text) => String(text || "").replace(/[^\p{L}\p{N}]/gu, "");

export class NotionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ---------- Notion API ---------- */

/* 建立一個用某位使用者授權呼叫 Notion 的 client
   沒有 body 時用 GET、有 body 用 POST（可指定 PATCH） */
export function createClient(token) {
  async function notion(path, body, { method } = {}) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`https://api.notion.com/v1/${path}`, {
        method: method || (body ? "POST" : "GET"),
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      /* 超過速率限制就等一下再試 */
      if (res.status === 429 && attempt < 5) {
        await sleep((Number(res.headers.get("retry-after")) || 1) * 1000);
        continue;
      }

      const json = await res.json().catch(() => ({}));
      if (res.ok) return json;

      const hints = {
        401: "Notion 授權已失效，請重新登入",
        404: "找不到這個頁面，請確認登入時有選擇分享這個頁面給「我的旅行」",
      };
      throw new NotionError(res.status, hints[res.status] || `Notion 回應錯誤（${res.status}）：${json.message || "未知錯誤"}`);
    }
  }

  async function paginate(fetchPage) {
    const results = [];
    let cursor;
    do {
      const page = await fetchPage(cursor);
      results.push(...page.results);
      cursor = page.has_more ? page.next_cursor : undefined;
    } while (cursor);
    return results;
  }

  return {
    request: notion,
    queryAll: (databaseId) =>
      paginate((cursor) => notion(`databases/${databaseId}/query`, { page_size: 100, start_cursor: cursor })),
    listChildren: (blockId) =>
      paginate((cursor) => notion(`blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`)),
    search: (filter) =>
      paginate((cursor) => notion("search", { filter, page_size: 100, start_cursor: cursor })),
  };
}

/* 寫入用的欄位值 */
const value = {
  title: (s) => ({ title: [{ text: { content: String(s ?? "") } }] }),
  text: (s) => ({ rich_text: s ? [{ text: { content: String(s) } }] : [] }),
  number: (n) => ({ number: n ?? null }),
  select: (s) => ({ select: s ? { name: s } : null }),
  multi: (list) => ({ multi_select: list.map((name) => ({ name })) }),
  check: (b) => ({ checkbox: Boolean(b) }),
  date: (d) => ({ date: d ? { start: d } : null }),
  phone: (p) => ({ phone_number: p || null }),
};

/* 讀取欄位值（依欄位型別轉成字串、數字、陣列…） */
function read(page, name) {
  const prop = page.properties?.[name];
  if (!prop) return undefined;
  switch (prop.type) {
    case "title":
    case "rich_text":
      return prop[prop.type].map((t) => t.plain_text).join("").trim();
    case "number":       return prop.number;
    case "select":       return prop.select?.name ?? "";
    case "multi_select": return prop.multi_select.map((o) => o.name);
    case "checkbox":     return prop.checkbox;
    case "date":         return prop.date?.start?.slice(0, 10) ?? "";
    case "phone_number": return prop.phone_number ?? "";
    default:             return undefined;
  }
}

const pageTitleOf = (page) => {
  const prop = Object.values(page.properties || {}).find((p) => p.type === "title");
  return prop?.title.map((t) => t.plain_text).join("").trim() || "未命名頁面";
};

/* ---------- 頁面與表單 ---------- */

/* 使用者分享給「我的旅行」的最上層頁面（可以當作放國家頁面的上層頁面） */
export async function listTopPages(client) {
  const pages = await client.search({ property: "object", value: "page" });
  const ids = new Set(pages.map((p) => plainId(p.id)));
  return pages
    .filter((p) => !p.archived && !p.in_trash)
    .filter((p) => p.parent?.type !== "page_id" || !ids.has(plainId(p.parent.page_id)))
    .filter((p) => p.parent?.type !== "database_id")
    .map((p) => ({ id: plainId(p.id), title: pageTitleOf(p), url: p.url }));
}

/* 上層頁面底下：子頁面＝國家；直接放在上層頁面的表單是舊版留下的 */
export async function scanParent(client, parentId) {
  const blocks = await client.listChildren(parentId);
  return {
    countries: blocks
      .filter((b) => b.type === "child_page")
      .map((b) => ({ id: plainId(b.id), title: b.child_page.title.trim() })),
    legacyTables: blocks.filter((b) => b.type === "child_database").length,
  };
}

/* 國家頁面裡依標題找 5 張表 */
async function findTables(client, pageId) {
  const found = {};
  for (const block of await client.listChildren(pageId)) {
    if (block.type !== "child_database") continue;
    const key = Object.keys(TABLES).find((k) => plainTitle(TABLES[k].title) === plainTitle(block.child_database.title));
    if (key && !found[key]) found[key] = plainId(block.id);
  }
  return found;
}

/* ---------- 讀取：一個國家頁面 → 一趟行程 ---------- */

/* 讀一個國家頁面的 5 張表，轉成網頁行程（缺資料時 destination 為 null，原因放在 warnings） */
export async function readCountry(client, country, config) {
  const tables = await findTables(client, country.id);
  const rows = {};
  for (const key of Object.keys(TABLES)) rows[key] = tables[key] ? await client.queryAll(tables[key]) : null;
  return toDestination(country, rows, config);
}

export function toDestination(country, rows, config) {
  const warnings = [];
  const name = country.title || "未命名國家";
  const labelToKey = Object.fromEntries(Object.entries(config.transports).map(([k, t]) => [t.label, k]));
  const byTime = (a, b) => (read(a, "時間") || "").localeCompare(read(b, "時間") || "");
  const done = (destination) => ({ destination, warnings: [...new Set(warnings)] });

  const missing = Object.keys(TABLES).filter((k) => TABLES[k].required && !rows[k]).map((k) => `「${TABLES[k].title}」表`);
  if (missing.length) {
    warnings.push(`「${name}」頁面缺少${missing.join("、")}，這次先不顯示`);
    return done(null);
  }

  /* 行程：依「第幾天」分組，依序就是 Day 1、Day 2… */
  const groups = new Map();
  for (const r of rows.itinerary) {
    const n = read(r, "第幾天");
    if (!Number.isInteger(n) || n < 1) {
      warnings.push(`「${name}」的行程「${read(r, "名稱") || "未命名"}」沒有填第幾天，已略過`);
      continue;
    }
    if (!groups.has(n)) groups.set(n, []);
    groups.get(n).push(r);
  }
  const numbers = [...groups.keys()].sort((a, b) => a - b);
  if (!numbers.length) {
    warnings.push(`「${name}」還沒有行程，這次先不顯示`);
    return done(null);
  }
  for (let n = 1; n < numbers[numbers.length - 1]; n++) {
    if (!groups.has(n)) warnings.push(`「${name}」第 ${n} 天沒有行程，後面的日子會往前遞補`);
  }

  const days = numbers.map((n) => {
    const list = groups.get(n).sort(byTime);
    return {
      number: n, /* Notion 裡的「第幾天」，新增行程時用 */
      city: list.map((r) => read(r, "城市")).find(Boolean) || "",
      theme: list.map((r) => read(r, "當日主題")).find(Boolean) || "",
      items: list.map((r) => ({
        uid: plainId(r.id),
        time: read(r, "時間") || "",
        title: read(r, "名稱") || "",
        note: read(r, "說明") || "",
        transport: (read(r, "交通") || []).map((label) => {
          if (!labelToKey[label]) warnings.push(`交通「${label}」不在網頁的交通標籤裡，已略過`);
          return labelToKey[label];
        }).filter(Boolean),
        must: Boolean(read(r, "必去")),
      })),
    };
  });

  /* 航班可以之後再新增：沒有去程或回程時就不顯示那一張 */
  const outbound = rows.flights?.find((f) => read(f, "類型") === "去程");
  const inbound = rows.flights?.find((f) => read(f, "類型") === "回程");

  /* 去程抵達＝第一天的城市機場，回程出發＝最後一天的城市機場（沒填時補上） */
  const firstCity = findCity(days[0].city);
  const lastCity = findCity(days[days.length - 1].city);
  const str = (page, prop) => read(page, prop) || "";
  const toFlight = (page, airport = {}) => ({
    uid: plainId(page.id),
    airline: str(page, "航空公司"),
    number: str(page, "航班"),
    from: {
      code: str(page, "出發機場") || airport.from || "", city: str(page, "出發城市"),
      time: str(page, "出發時間"), terminal: str(page, "出發航廈"),
    },
    to: {
      code: str(page, "抵達機場") || airport.to || "", city: str(page, "抵達城市"),
      time: str(page, "抵達時間"), terminal: str(page, "抵達航廈"),
    },
    duration: str(page, "飛行時間"),
    seat: str(page, "座位"),
    passengers: parsePassengers(str(page, "旅客")),
    baggage: str(page, "行李"),
  });

  /* 旅程設定只看第一列，沒有這張表時用預設值 */
  const settings = rows.settings?.[0];
  const setting = (prop) => (settings ? read(settings, prop) : undefined);
  const cities = [...new Set(days.map((d) => d.city).filter(Boolean))];

  return done({
    id: setting("代號") || COUNTRIES[name]?.id || country.id.slice(0, 8),
    notionPageId: country.id, /* 網頁新增或編輯時，用來找到這個國家頁面 */
    settingsId: settings ? plainId(settings.id) : "",
    name,
    flag: COUNTRIES[name]?.flag || "",
    title: setting("名稱") || `${name}小旅行`,
    tagline: setting("副標") || cities.join("、"),
    art: ART_OPTIONS[setting("插圖")] || firstCity?.art || "heroGeneric",
    startDate: setting("出發日") || config.startDate,
    order: setting("排序") ?? 999,
    flights: {
      ...(outbound && { outbound: toFlight(outbound, { to: firstCity?.airport }) }),
      ...(inbound && { inbound: toFlight(inbound, { from: lastCity?.airport }) }),
    },
    days,
    lodgings: (rows.lodging || []).map((l) => ({
      uid: plainId(l.id),
      city: str(l, "城市"),
      name: str(l, "名稱"),
      address: str(l, "地址"),
      room: str(l, "房型"),
      checkInTime: str(l, "入住時間") || "15:00",
      checkOutTime: str(l, "退房時間") || "11:00",
      bookingNo: str(l, "訂房編號"),
      phone: str(l, "電話"),
      mapQuery: str(l, "地圖搜尋") || str(l, "名稱"),
    })),
    checklist: (rows.checklist || [])
      .sort((a, b) => (read(a, "排序") ?? 999) - (read(b, "排序") ?? 999))
      .map((c) => ({ id: plainId(c.id), text: str(c, "項目"), hint: str(c, "說明") })),
  });
}

/* ---------- 建立：範例國家頁面 ---------- */

/* 建立國家頁面與 5 張空表（約 6 次請求），回傳各表 ID */
export async function createCountryPage(client, parentId, dest, config) {
  const all = schemas(config);
  const page = await client.request("pages", {
    parent: { page_id: parentId },
    icon: { type: "emoji", emoji: dest.flag || COUNTRIES[dest.name]?.flag || "🧳" },
    properties: { title: { title: [{ text: { content: dest.name } }] } },
    children: [
      {
        object: "block",
        type: "callout",
        callout: {
          icon: { type: "emoji", emoji: "💡" },
          rich_text: [{
            type: "text",
            text: { content: "一個國家一個頁面。「行程」的第幾天決定天數，城市決定住宿日期與機場。要新增國家：複製這個頁面、改成國家名稱，再到網頁按「從 Notion 同步」。" },
          }],
        },
      },
    ],
  });
  const pageId = plainId(page.id);

  const tables = {};
  for (const [key, table] of Object.entries(TABLES)) {
    const db = await client.request("databases", {
      parent: { type: "page_id", page_id: pageId },
      icon: { type: "emoji", emoji: table.icon },
      title: [{ type: "text", text: { content: table.title } }],
      is_inline: true,
      properties: all[key],
    });
    tables[key] = plainId(db.id);
  }
  return { pageId, tables };
}

/* 範例資料要寫進各表的列（純計算，不呼叫 API） */
export function seedRows(dest, config, order = 1) {
  const artName = Object.keys(ART_OPTIONS).find((k) => ART_OPTIONS[k] === dest.art) || "通用";
  const labels = (keys) => keys.map((k) => config.transports[k]?.label).filter(Boolean);
  const checklist = [...(config.checklistBefore || []), ...(dest.checklist || []), ...(config.checklistAfter || [])];

  return {
    settings: [{
      名稱: value.title(dest.title),
      副標: value.text(dest.tagline),
      出發日: value.date(dest.startDate || config.startDate),
      插圖: value.select(artName),
      代號: value.text(dest.id),
      排序: value.number(order),
    }],
    flights: [["去程", dest.flights?.outbound], ["回程", dest.flights?.inbound]].filter(([, f]) => f).map(([type, f]) => ({
      航班: value.title(f.number),
      類型: value.select(type),
      航空公司: value.text(f.airline),
      出發機場: value.text(f.from.code),
      出發城市: value.text(f.from.city),
      出發時間: value.text(f.from.time),
      出發航廈: value.text(f.from.terminal),
      抵達機場: value.text(f.to.code),
      抵達城市: value.text(f.to.city),
      抵達時間: value.text(f.to.time),
      抵達航廈: value.text(f.to.terminal),
      飛行時間: value.text(f.duration),
      座位: value.text(f.seat),
      旅客: value.text(formatPassengers(f.passengers)),
      行李: value.text(f.baggage),
    })),
    itinerary: dest.days.flatMap((day, n) =>
      day.items.map((item, i) => ({
        名稱: value.title(item.title),
        第幾天: value.number(n + 1),
        城市: value.select(day.city),
        當日主題: value.text(i === 0 ? day.theme : ""), /* 主題填在當天第一筆即可 */
        時間: value.text(item.time),
        說明: value.text(item.note),
        交通: value.multi(labels(item.transport || [])),
        必去: value.check(item.must),
      }))
    ),
    lodging: (dest.lodgings || []).map((l) => ({
      名稱: value.title(l.name),
      城市: value.select(l.city),
      地址: value.text(l.address),
      房型: value.text(l.room),
      入住時間: value.text(l.checkInTime),
      退房時間: value.text(l.checkOutTime),
      訂房編號: value.text(l.bookingNo),
      電話: value.phone(l.phone),
      地圖搜尋: value.text(l.mapQuery),
    })),
    checklist: checklist.map((item, n) => ({
      項目: value.title(item.text),
      說明: value.text(item.hint),
      排序: value.number((n + 1) * 10),
    })),
  };
}

/* 把一批列寫進表裡（每列一次請求，間隔避免超過 Notion 速率限制） */
export async function createRows(client, databaseId, rows) {
  for (const properties of rows) {
    await client.request("pages", { parent: { database_id: databaseId }, properties });
    await sleep(340);
  }
  return rows.length;
}

/* ---------- 新增：網頁上填的一筆行程 ---------- */

const MAX_DAY = 60;

/* 檢查並整理網頁送來的行程；有問題時丟出可以直接顯示給使用者的錯誤 */
export function cleanItem(item, config) {
  const title = String(item?.title || "").trim();
  if (!title) throw new NotionError(400, "請填寫行程名稱");

  const day = Number(item.day);
  if (!Number.isInteger(day) || day < 1 || day > MAX_DAY) throw new NotionError(400, `第幾天請填 1 到 ${MAX_DAY}`);

  const time = String(item.time || "").trim();
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new NotionError(400, "時間格式請用 09:30");

  /* Notion 的選項名稱不能有逗號 */
  const city = String(item.city || "").replace(/,/g, " ").trim().slice(0, 100);
  const transport = (Array.isArray(item.transport) ? item.transport : []).filter((k) => config.transports[k]);

  return {
    day,
    city,
    theme: item.theme === undefined ? undefined : String(item.theme || "").trim().slice(0, 200),
    time,
    title: title.slice(0, 200),
    note: String(item.note || "").trim().slice(0, 2000),
    transport,
    must: Boolean(item.must),
  };
}

/* ---------- 刪除：把國家頁面移到 Notion 垃圾桶（30 天內可以在 Notion 還原） ---------- */

export async function archiveCountryPage(client, pageId) {
  await client.request(`pages/${pageId}`, { archived: true }, { method: "PATCH" });
  return { archived: true };
}

/* ---------- 新增：網頁上填的一筆航班 ---------- */

/* 檢查並整理網頁送來的航班；有問題時丟出可以直接顯示給使用者的錯誤 */
export function cleanFlight(raw) {
  const type = raw?.type === "回程" ? "回程" : raw?.type === "去程" ? "去程" : "";
  if (!type) throw new NotionError(400, "請選擇去程或回程");

  const text = (v, max = 100) => String(v ?? "").trim().slice(0, max);
  const number = text(raw.number, 30).toUpperCase();
  if (!number) throw new NotionError(400, "請填寫航班號碼");

  const time = (v) => {
    const t = text(v, 5);
    if (t && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) throw new NotionError(400, "時間格式請用 08:20");
    return t;
  };
  const place = (p) => ({
    code: text(p?.code, 4).toUpperCase(),
    city: text(p?.city, 50),
    time: time(p?.time),
    terminal: text(p?.terminal, 50),
  });
  const passengers = cleanPassengers(raw.passengers);

  return {
    type,
    airline: text(raw.airline, 50),
    number,
    from: place(raw.from),
    to: place(raw.to),
    duration: text(raw.duration, 20),
    /* 有旅客時，「座位」欄位改放所有人的座位，舊版也看得到 */
    seat: passengers.length ? passengers.map((p) => p.seat).filter(Boolean).join("、").slice(0, 100) : text(raw.seat, 20),
    passengers,
    baggage: text(raw.baggage, 50),
  };
}

/* 旅客：每位一個姓名與座位，最多 20 位；Notion 裡一行一位，寫成「姓名｜座位」 */
function cleanPassengers(list) {
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, 20)
    .map((p) => ({ name: text(p?.name, 30).replace(/[｜\n]/g, " "), seat: text(p?.seat, 10).replace(/[｜\n]/g, " ").toUpperCase() }))
    .filter((p) => p.name || p.seat);
}

const formatPassengers = (list) => (list || []).map((p) => `${p.name}｜${p.seat}`).join("\n");

function parsePassengers(s) {
  return cleanPassengers(
    String(s || "")
      .split("\n")
      .map((line) => {
        const [name, seat = ""] = line.split("｜");
        return { name, seat };
      })
  );
}

/* ---------- 網頁編輯：住宿、清單、旅程設定的檢查 ---------- */

const text = (v, max = 100) => String(v ?? "").trim().slice(0, max);
const checkTime = (v, example) => {
  const t = text(v, 5);
  if (t && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) throw new NotionError(400, `時間格式請用 ${example}`);
  return t;
};

export function cleanLodging(raw) {
  const name = text(raw?.name, 200);
  if (!name) throw new NotionError(400, "請填寫住宿名稱");
  return {
    name,
    city: text(raw.city).replace(/,/g, " "),
    address: text(raw.address, 500),
    room: text(raw.room),
    checkInTime: checkTime(raw.checkInTime, "15:00") || "15:00",
    checkOutTime: checkTime(raw.checkOutTime, "11:00") || "11:00",
    bookingNo: text(raw.bookingNo),
    phone: text(raw.phone, 50),
    mapQuery: text(raw.mapQuery, 200),
  };
}

export function cleanChecklist(raw) {
  const itemText = text(raw?.text, 200);
  if (!itemText) throw new NotionError(400, "請填寫項目");
  const order = Number(raw.order);
  return { text: itemText, hint: text(raw.hint, 500), order: Number.isFinite(order) ? order : null };
}

export function cleanSettings(raw) {
  const title = text(raw?.title, 200);
  if (!title) throw new NotionError(400, "請填寫行程標題");
  const startDate = text(raw.startDate, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new NotionError(400, "請選擇出發日");
  return { title, tagline: text(raw.tagline, 200), startDate };
}

/* 每張表：檢查網頁送來的值 → 轉成 Notion 欄位 */
const ROWS = {
  itinerary: {
    clean: cleanItem,
    props: (v, config) => ({
      名稱: value.title(v.title),
      第幾天: value.number(v.day),
      城市: value.select(v.city || null),
      ...(v.theme !== undefined && { 當日主題: value.text(v.theme) }),
      時間: value.text(v.time),
      說明: value.text(v.note),
      交通: value.multi(v.transport.map((k) => config.transports[k].label)),
      必去: value.check(v.must),
    }),
  },
  flights: {
    clean: cleanFlight,
    props: (f) => ({
      航班: value.title(f.number),
      類型: value.select(f.type),
      航空公司: value.text(f.airline),
      出發機場: value.text(f.from.code),
      出發城市: value.text(f.from.city),
      出發時間: value.text(f.from.time),
      出發航廈: value.text(f.from.terminal),
      抵達機場: value.text(f.to.code),
      抵達城市: value.text(f.to.city),
      抵達時間: value.text(f.to.time),
      抵達航廈: value.text(f.to.terminal),
      飛行時間: value.text(f.duration),
      座位: value.text(f.seat),
      旅客: value.text(formatPassengers(f.passengers)),
      行李: value.text(f.baggage),
    }),
  },
  lodging: {
    clean: cleanLodging,
    props: (l) => ({
      名稱: value.title(l.name),
      城市: value.select(l.city || null),
      地址: value.text(l.address),
      房型: value.text(l.room),
      入住時間: value.text(l.checkInTime),
      退房時間: value.text(l.checkOutTime),
      訂房編號: value.text(l.bookingNo),
      電話: value.phone(l.phone),
      地圖搜尋: value.text(l.mapQuery),
    }),
  },
  checklist: {
    clean: cleanChecklist,
    props: (c) => ({ 項目: value.title(c.text), 說明: value.text(c.hint), ...(c.order !== null && { 排序: value.number(c.order) }) }),
  },
  settings: {
    clean: cleanSettings,
    props: (v) => ({ 名稱: value.title(v.title), 副標: value.text(v.tagline), 出發日: value.date(v.startDate) }),
  },
};

/* 網頁上的新增／修改／刪除一列
   op：create（需要 pageId＝國家頁面）、update / delete（需要 rowId）
   刪除是移到 Notion 垃圾桶，可以在 Notion 還原 */
export async function editRow(client, { op, table, pageId, rowId, values }, config) {
  const spec = ROWS[table];
  if (!spec) throw new NotionError(400, "不支援這張表");

  if (op === "delete") {
    await client.request(`pages/${toNotionId(rowId)}`, { archived: true }, { method: "PATCH" });
    return { deleted: true };
  }

  const row = spec.clean(values, config);
  const properties = spec.props(row, config);

  if (op === "update") {
    if (table === "flights") {
      const page = await client.request(`pages/${toNotionId(rowId)}`);
      await ensureColumn(client, page.parent?.database_id, "旅客");
    }
    await client.request(`pages/${toNotionId(rowId)}`, { properties }, { method: "PATCH" });
    return { id: toNotionId(rowId), row };
  }
  if (op === "create") {
    const tables = await findTables(client, toNotionId(pageId));
    if (!tables[table]) throw new NotionError(404, `這個國家頁面沒有「${TABLES[table].title}」表`);
    if (table === "flights") await ensureColumn(client, tables[table], "旅客");
    const page = await client.request("pages", { parent: { database_id: tables[table] }, properties });
    return { id: plainId(page.id), row };
  }
  throw new NotionError(400, "不支援這個動作");
}

/* 舊的表沒有新欄位（例如航班的「旅客」）時自動補上文字欄位 */
async function ensureColumn(client, databaseId, name) {
  if (!databaseId) return;
  const db = await client.request(`databases/${databaseId}`);
  if (db.properties?.[name]) return;
  await client.request(`databases/${databaseId}`, { properties: { [name]: { rich_text: {} } } }, { method: "PATCH" });
}

/* 編輯一整天的主題與城市：主題寫在當天第一筆、其他筆清空；城市每筆都更新 */
export async function editDay(client, { rowIds, theme, city }) {
  if (!Array.isArray(rowIds) || !rowIds.length || rowIds.length > 40) throw new NotionError(400, "這一天沒有可以更新的行程");
  const cleanCity = text(city).replace(/,/g, " ");
  const cleanTheme = text(theme, 200);
  for (const [i, id] of rowIds.entries()) {
    await client.request(
      `pages/${toNotionId(id)}`,
      { properties: { 城市: value.select(cleanCity || null), 當日主題: value.text(i === 0 ? cleanTheme : "") } },
      { method: "PATCH" }
    );
  }
  return { theme: cleanTheme, city: cleanCity };
}
