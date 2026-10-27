/* ============================================================
   Notion 本機工具（不需安裝套件，Node 20.12 以上）

   Notion 結構：連結的頁面（例如 Travel）
     └ 每個國家一個子頁面（韓國、日本…），裡面放 5 張表：
        旅程設定、航班、行程、住宿、準備清單

   npm run notion:setup   在連結的頁面下建立範例國家頁面（已存在的國家會略過）
   npm run notion:sync    掃描所有國家頁面，產生 js/data/notion-data.js
   npm run notion:cities  更新每個國家頁面的城市下拉選單

   金鑰與頁面 ID 放在專案根目錄的 .env（不會進 git）
   ============================================================ */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { CITIES, COUNTRIES, cityOption, findCity } from "./cities.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = join(ROOT, ".env");
const OUTPUT_FILE = join(ROOT, "js/data/notion-data.js");
const NOTION_VERSION = "2022-06-28";

/* ---------- 表單設計（每個國家頁面裡的 5 張表） ---------- */

const TABLES = {
  settings:  { title: "旅程設定", icon: "⚙️" },
  flights:   { title: "航班",     icon: "✈️", required: true },
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

/* 舊版（所有地點放在同一頁）留在 .env 的設定，連結／中斷時一併清掉 */
const LEGACY_KEYS = Object.fromEntries(
  ["DESTINATIONS", "FLIGHTS", "ITINERARY", "CHECKLIST", "SETTINGS"].map((k) => [`NOTION_DB_${k}`, null])
);

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

/* ---------- Notion API ---------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`.env 缺少 ${name}，請參考 .env.example`);
  return value;
}

/* 接受 Notion 網址或 ID，取出 32 碼 ID */
export function toNotionId(value) {
  const match = value.replace(/-/g, "").match(/[0-9a-f]{32}(?=[^0-9a-f]*$)/i);
  if (!match) throw new Error(`看不懂這個 Notion 網址或 ID：${value}`);
  return match[0];
}

const plainId = (id) => id.replace(/-/g, "");

/* 比對標題時忽略表情符號與空白：「✈️ 航班」＝「航班」 */
const plainTitle = (text) => text.replace(/[^\p{L}\p{N}]/gu, "");

/* 沒有 body 時用 GET、有 body 用 POST（可指定 PATCH）
   token 預設讀 .env，連結時可先帶入新金鑰驗證 */
async function notion(path, body, { token = requireEnv("NOTION_TOKEN"), method } = {}) {
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

    const json = await res.json();
    if (res.ok) return json;

    const hints = {
      401: "整合金鑰（NOTION_TOKEN）不正確或已失效",
      404: "找不到頁面或表單，請確認已在 Notion 頁面的「連線」加入你的整合",
    };
    throw new Error(`Notion API 錯誤（${res.status}）：${json.message}${hints[res.status] ? `\n→ ${hints[res.status]}` : ""}`);
  }
}

async function queryAll(databaseId) {
  const results = [];
  let cursor;
  do {
    const page = await notion(`databases/${databaseId}/query`, { page_size: 100, start_cursor: cursor });
    results.push(...page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return results;
}

async function listChildren(blockId, token) {
  const results = [];
  let cursor;
  do {
    const query = `page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`;
    const res = await notion(`blocks/${blockId}/children?${query}`, null, { token });
    results.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return results;
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
  const prop = page.properties[name];
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
    case "relation":     return prop.relation.map((r) => plainId(r.id));
    default:             return undefined;
  }
}

/* ---------- 找國家頁面與表單 ---------- */

/* 連結頁面底下：子頁面＝國家；直接放在連結頁面上的表單是舊版留下的 */
async function scanParent(parentId, token) {
  const blocks = await listChildren(parentId, token);
  return {
    countries: blocks
      .filter((b) => b.type === "child_page")
      .map((b) => ({ id: plainId(b.id), title: b.child_page.title.trim() })),
    legacyTables: blocks.filter((b) => b.type === "child_database").length,
  };
}

/* 國家頁面裡依標題找 5 張表 */
async function findTables(pageId) {
  const found = {};
  for (const block of await listChildren(pageId)) {
    if (block.type !== "child_database") continue;
    const key = Object.keys(TABLES).find((k) => plainTitle(TABLES[k].title) === plainTitle(block.child_database.title));
    if (key && !found[key]) found[key] = plainId(block.id);
  }
  return found;
}

/* ---------- 讀取網頁現有資料（js/data/*.js） ---------- */

function loadSiteData() {
  const context = vm.createContext({});
  context.window = context;
  const files = [
    "js/data/config.js",
    ...readdirSync(join(ROOT, "js/data/destinations"))
      .filter((f) => f.endsWith(".js"))
      .sort()
      .map((f) => `js/data/destinations/${f}`),
  ];
  files.forEach((file) => vm.runInContext(readFileSync(join(ROOT, file), "utf8"), context, { filename: file }));
  return context.Trip;
}

/* ---------- setup：建立範例國家頁面 ---------- */

export async function setupNotion() {
  const parentId = toNotionId(requireEnv("NOTION_PARENT_PAGE"));
  const { config, destinations } = loadSiteData();
  const all = schemas(config);
  const labels = (keys) => keys.map((k) => config.transports[k]?.label).filter(Boolean);
  const artName = (art) => Object.keys(ART_OPTIONS).find((k) => ART_OPTIONS[k] === art) || "通用";

  const { countries } = await scanParent(parentId);
  const existing = new Set(countries.map((c) => plainTitle(c.title)));
  const created = [];

  /* 依出發日排序：最早出發的行程排在最前面 */
  const ordered = [...destinations].sort((a, b) =>
    (a.startDate || config.startDate).localeCompare(b.startDate || config.startDate)
  );

  for (const [order, d] of ordered.entries()) {
    if (existing.has(plainTitle(d.name))) {
      console.log(`· 「${d.name}」頁面已經存在，略過`);
      continue;
    }

    const page = await notion("pages", {
      parent: { page_id: parentId },
      icon: { type: "emoji", emoji: d.flag || COUNTRIES[d.name]?.flag || "🧳" },
      properties: { title: { title: [{ text: { content: d.name } }] } },
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
    console.log(`✓ 建立國家頁面「${d.name}」`);

    const ids = {};
    for (const [key, table] of Object.entries(TABLES)) {
      const db = await notion("databases", {
        parent: { type: "page_id", page_id: pageId },
        icon: { type: "emoji", emoji: table.icon },
        title: [{ type: "text", text: { content: table.title } }],
        is_inline: true,
        properties: all[key],
      });
      ids[key] = plainId(db.id);
    }

    const add = async (key, properties) => {
      await notion("pages", { parent: { database_id: ids[key] }, properties });
      await sleep(340); /* Notion 限制每秒約 3 次請求 */
    };

    await add("settings", {
      名稱: value.title(d.title),
      副標: value.text(d.tagline),
      出發日: value.date(d.startDate || config.startDate),
      插圖: value.select(artName(d.art)),
      代號: value.text(d.id),
      排序: value.number(order + 1),
    });

    for (const [type, f] of [["去程", d.flights.outbound], ["回程", d.flights.inbound]]) {
      await add("flights", {
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
        行李: value.text(f.baggage),
      });
    }

    for (const [n, day] of d.days.entries()) {
      for (const [i, item] of day.items.entries()) {
        await add("itinerary", {
          名稱: value.title(item.title),
          第幾天: value.number(n + 1),
          城市: value.select(day.city),
          當日主題: value.text(i === 0 ? day.theme : ""), /* 主題填在當天第一筆即可 */
          時間: value.text(item.time),
          說明: value.text(item.note),
          交通: value.multi(labels(item.transport || [])),
          必去: value.check(item.must),
        });
      }
    }

    for (const l of d.lodgings || []) {
      await add("lodging", {
        名稱: value.title(l.name),
        城市: value.select(l.city),
        地址: value.text(l.address),
        房型: value.text(l.room),
        入住時間: value.text(l.checkInTime),
        退房時間: value.text(l.checkOutTime),
        訂房編號: value.text(l.bookingNo),
        電話: value.phone(l.phone),
        地圖搜尋: value.text(l.mapQuery),
      });
    }

    const checklist = [...config.checklistBefore, ...d.checklist, ...config.checklistAfter];
    for (const [n, item] of checklist.entries()) {
      await add("checklist", {
        項目: value.title(item.text),
        說明: value.text(item.hint),
        排序: value.number((n + 1) * 10),
      });
    }

    console.log(`  行程 ${d.days.length} 天、住宿 ${(d.lodgings || []).length} 間、清單 ${checklist.length} 項`);
    created.push(d.name);
  }

  return created;
}

/* ---------- sync：掃描國家頁面，轉成網頁資料 ---------- */

export async function fetchFromNotion() {
  const parentId = toNotionId(requireEnv("NOTION_PARENT_PAGE"));
  const { countries, legacyTables } = await scanParent(parentId);

  const pages = [];
  for (const country of countries) {
    const tables = await findTables(country.id);
    const rows = {};
    for (const key of Object.keys(TABLES)) rows[key] = tables[key] ? await queryAll(tables[key]) : null;
    pages.push({ ...country, rows });
  }

  const result = toSiteData(loadSiteData().config, pages);
  if (legacyTables) result.warnings.push(`連結的頁面上還有 ${legacyTables} 張舊版表單，已不再使用，可以在 Notion 刪除`);
  return result;
}

export function toSiteData(config, countries) {
  const warnings = [];
  const labelToKey = Object.fromEntries(Object.entries(config.transports).map(([k, t]) => [t.label, k]));
  const byTime = (a, b) => read(a, "時間").localeCompare(read(b, "時間"));
  const usedIds = new Set();
  const destinations = [];

  for (const country of countries) {
    const name = country.title || "未命名國家";
    const { rows } = country;

    const missing = Object.keys(TABLES).filter((k) => TABLES[k].required && !rows[k]).map((k) => `「${TABLES[k].title}」表`);
    if (missing.length) {
      warnings.push(`「${name}」頁面缺少${missing.join("、")}，這次先不顯示`);
      continue;
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
      continue;
    }
    for (let n = 1; n < numbers[numbers.length - 1]; n++) {
      if (!groups.has(n)) warnings.push(`「${name}」第 ${n} 天沒有行程，後面的日子會往前遞補`);
    }

    const days = numbers.map((n) => {
      const list = groups.get(n).sort(byTime);
      return {
        city: list.map((r) => read(r, "城市")).find(Boolean) || "",
        theme: list.map((r) => read(r, "當日主題")).find(Boolean) || "",
        items: list.map((r) => ({
          time: read(r, "時間"),
          title: read(r, "名稱"),
          note: read(r, "說明"),
          transport: (read(r, "交通") || []).map((label) => {
            if (!labelToKey[label]) warnings.push(`交通「${label}」不在 config.js 的 transports 裡，已略過`);
            return labelToKey[label];
          }).filter(Boolean),
          must: read(r, "必去"),
        })),
      };
    });

    const outbound = rows.flights.find((f) => read(f, "類型") === "去程");
    const inbound = rows.flights.find((f) => read(f, "類型") === "回程");
    if (!outbound || !inbound) {
      warnings.push(`「${name}」缺少${!outbound ? "去程" : "回程"}航班，這次先不顯示`);
      continue;
    }

    /* 去程抵達＝第一天的城市機場，回程出發＝最後一天的城市機場（沒填時補上） */
    const firstCity = findCity(days[0].city);
    const lastCity = findCity(days[days.length - 1].city);
    const toFlight = (page, airport = {}) => ({
      airline: read(page, "航空公司"),
      number: read(page, "航班"),
      from: {
        code: read(page, "出發機場") || airport.from || "", city: read(page, "出發城市"),
        time: read(page, "出發時間"), terminal: read(page, "出發航廈"),
      },
      to: {
        code: read(page, "抵達機場") || airport.to || "", city: read(page, "抵達城市"),
        time: read(page, "抵達時間"), terminal: read(page, "抵達航廈"),
      },
      duration: read(page, "飛行時間"),
      seat: read(page, "座位"),
      baggage: read(page, "行李"),
    });

    /* 旅程設定只看第一列，沒有這張表時用預設值 */
    const settings = rows.settings?.[0];
    const setting = (prop) => (settings ? read(settings, prop) : undefined);
    const cities = [...new Set(days.map((d) => d.city).filter(Boolean))];

    let id = setting("代號") || COUNTRIES[name]?.id || country.id.slice(0, 8);
    if (usedIds.has(id)) id = `${id}-${country.id.slice(0, 4)}`;
    usedIds.add(id);

    destinations.push({
      id,
      name,
      flag: COUNTRIES[name]?.flag || "",
      title: setting("名稱") || `${name}小旅行`,
      tagline: setting("副標") || cities.join("、"),
      art: ART_OPTIONS[setting("插圖")] || firstCity?.art || "heroGeneric",
      startDate: setting("出發日") || config.startDate,
      order: setting("排序") ?? 999,
      flights: {
        outbound: toFlight(outbound, { to: firstCity?.airport }),
        inbound: toFlight(inbound, { from: lastCity?.airport }),
      },
      days,
      lodgings: (rows.lodging || []).map((l) => ({
        city: read(l, "城市"),
        name: read(l, "名稱"),
        address: read(l, "地址"),
        room: read(l, "房型"),
        checkInTime: read(l, "入住時間") || "15:00",
        checkOutTime: read(l, "退房時間") || "11:00",
        bookingNo: read(l, "訂房編號"),
        phone: read(l, "電話"),
        mapQuery: read(l, "地圖搜尋") || read(l, "名稱"),
      })),
      checklist: (rows.checklist || [])
        .sort((a, b) => (read(a, "排序") ?? 999) - (read(b, "排序") ?? 999))
        .map((c) => ({ id: plainId(c.id), text: read(c, "項目"), hint: read(c, "說明") })),
    });
  }

  /* 依旅程設定的「排序」排列，相同時照 Notion 頁面順序 */
  destinations.sort((a, b) => a.order - b.order);
  destinations.forEach((d) => delete d.order);

  return { destinations, warnings: [...new Set(warnings)] };
}

export function renderDataFile(destinations, syncedAt = new Date()) {
  return `/* ============================================================
   Notion 同步資料 — 由 npm run notion:sync 自動產生，請勿手動修改
   有這份資料時，網頁會改用 Notion 的內容取代內建範例
   ============================================================ */
window.Trip = window.Trip || {};

Trip.dataSource = { type: "notion", syncedAt: ${JSON.stringify(syncedAt.toISOString())} };

/* 準備清單的共用項目已包含在各國清單裡 */
Trip.config.checklistBefore = [];
Trip.config.checklistAfter = [];

Trip.destinations = ${JSON.stringify(destinations, null, 2)};
`;
}

const PLACEHOLDER_FILE = `/* ============================================================
   Notion 同步資料 — 由 npm run notion:sync 自動產生，請勿手動修改
   尚未同步時保持空白，網頁會使用 js/data/destinations/ 的內建範例
   ============================================================ */
`;

/* ---------- 給 CLI 與本機伺服器共用的動作 ---------- */

export function loadEnv() {
  try {
    process.loadEnvFile(ENV_FILE);
  } catch {
    /* 沒有 .env 時，後面 requireEnv 會給出提示 */
  }
}

/* 更新 .env 指定的幾行（null＝刪除），其他設定保持不變 */
export function updateEnv(changes) {
  let lines = [];
  try {
    lines = readFileSync(ENV_FILE, "utf8").trimEnd().split("\n");
  } catch {
    /* 還沒有 .env，等一下建立 */
  }
  for (const [key, val] of Object.entries(changes)) {
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    if (val == null) {
      if (index >= 0) lines.splice(index, 1);
      delete process.env[key];
      continue;
    }
    if (index >= 0) lines[index] = `${key}=${val}`;
    else lines.push(`${key}=${val}`);
    process.env[key] = val;
  }
  writeFileSync(ENV_FILE, `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`);
}

async function pageTitle(pageId, token) {
  const page = await notion(`pages/${pageId}`, null, { token });
  const prop = Object.values(page.properties || {}).find((p) => p.type === "title");
  return prop?.title.map((t) => t.plain_text).join("") || "未命名頁面";
}

/* 連結：先用新金鑰讀一次頁面確認有權限，再寫進 .env */
export async function connectNotion(token, page) {
  token = String(token || "").trim();
  if (!token) throw new Error("請貼上 Notion 整合金鑰");
  const pageId = toNotionId(String(page || "").trim());
  const title = await pageTitle(pageId, token);
  updateEnv({ NOTION_TOKEN: token, NOTION_PARENT_PAGE: pageId, ...LEGACY_KEYS });
  return title;
}

/* 中斷連結：從 .env 移除金鑰（Notion 裡的頁面不會被刪除） */
export function disconnectNotion() {
  updateEnv({ NOTION_TOKEN: null, NOTION_PARENT_PAGE: null, ...LEGACY_KEYS });
}

/* 目前狀態（不回傳完整金鑰） */
export async function notionStatus() {
  const token = process.env.NOTION_TOKEN;
  const page = process.env.NOTION_PARENT_PAGE;
  const status = {
    connected: Boolean(token && page),
    token: token ? `${token.slice(0, 4)}••••${token.slice(-4)}` : "",
    countries: [],
  };
  if (!status.connected) return status;

  const pageId = toNotionId(page);
  status.pageUrl = `https://www.notion.so/${pageId}`;
  try {
    status.pageTitle = await pageTitle(pageId);
    const { countries, legacyTables } = await scanParent(pageId);
    status.countries = countries.map((c) => c.title);
    status.legacyTables = legacyTables;
  } catch (err) {
    status.error = err.message;
  }
  return status;
}

/* 同步：讀 Notion → 寫入 js/data/notion-data.js */
export async function syncToFile() {
  const { destinations, warnings } = await fetchFromNotion();
  if (!destinations.length) throw new Error("Notion 裡沒有完整的國家行程，沒有更新網頁");
  writeFileSync(OUTPUT_FILE, renderDataFile(destinations));
  return { destinations, warnings };
}

/* 城市選單：補齊每個國家頁面「行程」「住宿」的城市選項（不會刪除自己加的） */
export async function updateCityMenus() {
  const parentId = toNotionId(requireEnv("NOTION_PARENT_PAGE"));
  const { countries } = await scanParent(parentId);
  let updated = 0;

  for (const country of countries) {
    const tables = await findTables(country.id);
    for (const key of ["itinerary", "lodging"]) {
      if (!tables[key]) continue;
      const db = await notion(`databases/${tables[key]}`);
      const current = db.properties["城市"];
      if (current && current.type !== "select") {
        throw new Error(`「${country.title}」的「${TABLES[key].title}」已有名為「城市」但不是單選的欄位，請先改名或刪除`);
      }
      const existing = (current?.select.options || []).map(({ id, name, color }) => ({ id, name, color }));
      const names = new Set(existing.map((o) => o.name));
      const added = CITIES.filter((c) => !names.has(c.name)).map(cityOption);
      if (!added.length) continue;
      await notion(
        `databases/${tables[key]}`,
        { properties: { 城市: { select: { options: [...existing, ...added] } } } },
        { method: "PATCH" }
      );
      updated++;
    }
  }
  return { countries: countries.map((c) => c.title), updated };
}

/* 改回內建範例資料 */
export function resetDataFile() {
  writeFileSync(OUTPUT_FILE, PLACEHOLDER_FILE);
}

/* ---------- 指令列 ---------- */

async function main(command) {
  loadEnv();

  if (command === "setup") {
    const created = await setupNotion();
    console.log(created.length ? `\n完成！已建立：${created.join("、")}，接著執行 npm run notion:sync` : "\n沒有需要建立的國家頁面");
    return;
  }

  if (command === "sync") {
    const { destinations, warnings } = await syncToFile();
    warnings.forEach((w) => console.warn(`⚠ ${w}`));
    destinations.forEach((d) =>
      console.log(`✓ ${d.name}：${d.days.length} 天、住宿 ${d.lodgings.length} 間、清單 ${d.checklist.length} 項`)
    );
    console.log(`\n已更新 js/data/notion-data.js，重新整理網頁即可看到`);
    return;
  }

  if (command === "cities") {
    const { countries, updated } = await updateCityMenus();
    console.log(`✓ 檢查了 ${countries.length} 個國家頁面，更新 ${updated} 張表的城市選單`);
    return;
  }

  console.log("用法：npm run notion:setup | npm run notion:sync | npm run notion:cities");
}

/* 直接執行時才跑指令（被其他程式 import 時不執行） */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2]).catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
}
