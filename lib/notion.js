/* ============================================================
   Notion 核心：把網頁上的一趟行程匯出到使用者自己的 Notion
   只用 fetch，不依賴 Node，Cloudflare Worker 與本機測試都能用

   匯出的頁面（放在使用者選的頁面底下）：
     🇰🇷 行程標題
       📅 日期摘要（callout）
       ✈️ 航班      → 表格（類型、日期、機型、航廈、起降時間、旅客…）
       🗓️ 每日行程  → 表格（日期、第幾天、時間、城市、交通、必去…，可切換成日曆／看板）
       🏨 住宿      → 表格（入住～退房日期、地址、電話、訂房編號…）
       🧳 準備清單  → 可以打勾的待辦清單
   Cloudflare 免費方案一次請求最多 50 個子請求，所以分成「建立頁面」與「分批寫入表格」
   ============================================================ */

const NOTION_VERSION = "2022-06-28";

export const MAX_ROWS_PER_CALL = 20;

export class NotionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* 接受 32 碼或含 - 的 ID，轉成 Notion API 用的格式 */
export function toNotionId(value) {
  const id = String(value || "").replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(id)) throw new NotionError(400, "Notion ID 格式不正確");
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}

export const plainId = (id) => id.replace(/-/g, "");

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    search: (filter) => paginate((cursor) => notion("search", { filter, page_size: 100, start_cursor: cursor })),
  };
}

const pageTitleOf = (page) => {
  const prop = Object.values(page.properties || {}).find((p) => p.type === "title");
  return prop?.title.map((t) => t.plain_text).join("").trim() || "未命名頁面";
};

/* 使用者分享給「我的旅行」的最上層頁面（匯出時選一個放行程） */
export async function listTopPages(client) {
  const pages = await client.search({ property: "object", value: "page" });
  const ids = new Set(pages.map((p) => plainId(p.id)));
  return pages
    .filter((p) => !p.archived && !p.in_trash)
    .filter((p) => p.parent?.type !== "page_id" || !ids.has(plainId(p.parent.page_id)))
    .filter((p) => p.parent?.type !== "database_id")
    .map((p) => ({ id: plainId(p.id), title: pageTitleOf(p), url: p.url }));
}

/* ---------- 寫入用的欄位值與區塊 ---------- */

const text = (v, max = 2000) => String(v ?? "").trim().slice(0, max);
const isoDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? v : null);

const rich = (s) => (s ? [{ type: "text", text: { content: text(s) } }] : []);

const value = {
  title: (s) => ({ title: rich(s || "（未命名）") }),
  text: (s) => ({ rich_text: rich(s) }),
  select: (s) => ({ select: s ? { name: text(s, 100).replace(/,/g, " ") } : null }),
  multi: (list) => ({ multi_select: list.map((name) => ({ name: text(name, 100).replace(/,/g, " ") })) }),
  check: (b) => ({ checkbox: Boolean(b) }),
  date: (start, end) => ({ date: isoDate(start) ? { start, ...(isoDate(end) && end !== start ? { end } : {}) } : null }),
  phone: (p) => ({ phone_number: text(p, 50) || null }),
};

const block = {
  heading: (s, level = 2) => ({ type: `heading_${level}`, [`heading_${level}`]: { rich_text: rich(s) } }),
  paragraph: (s, color = "default") => ({ type: "paragraph", paragraph: { rich_text: rich(s), color } }),
  callout: (s, emoji, color) => ({ type: "callout", callout: { rich_text: rich(s), icon: { type: "emoji", emoji }, color } }),
  todo: (s, checked) => ({ type: "to_do", to_do: { rich_text: rich(s), checked: Boolean(checked) } }),
  divider: () => ({ type: "divider", divider: {} }),
};

/* 網頁標籤顏色 → Notion 選項顏色 */
const TONE_COLORS = {
  rose: "pink", lilac: "purple", sky: "blue", green: "green",
  butter: "yellow", peach: "orange", mint: "gray", sand: "brown",
};
const DAY_COLORS = ["blue", "green", "orange", "purple", "pink", "yellow", "brown", "red", "gray"];

/* ---------- 整理網頁送來的行程 ---------- */

/* 只留下建立頁面需要的欄位、限制長度與數量 */
export function cleanTrip(raw) {
  if (!raw || typeof raw !== "object") throw new NotionError(400, "行程資料不完整");
  const transports = Object.fromEntries(
    Object.entries(raw.transports && typeof raw.transports === "object" ? raw.transports : {})
      .slice(0, 30)
      .map(([key, t]) => [text(key, 40), { label: text(t?.label, 40), tone: text(t?.tone, 20) }])
      .filter(([, t]) => t.label)
  );
  return {
    title: text(raw.title, 200) || "我的旅行",
    flag: text(raw.flag, 8),
    tagline: text(raw.tagline, 500),
    dateRange: text(raw.dateRange, 60),
    summary: text(raw.summary, 200),
    dayCount: Math.min(Math.max(Math.floor(Number(raw.dayCount) || 0), 0), 60),
    cities: (Array.isArray(raw.cities) ? raw.cities : []).slice(0, 30).map((c) => text(c, 100)).filter(Boolean),
    transports,
    checklist: (Array.isArray(raw.checklist) ? raw.checklist : [])
      .slice(0, 90)
      .map((c) => ({ text: text(c?.text, 300), hint: text(c?.hint, 300), checked: Boolean(c?.checked) }))
      .filter((c) => c.text),
  };
}

/* ---------- 建立匯出頁面（第一步） ---------- */

function schemas(trip) {
  const t = { rich_text: {} };
  const cities = () => ({
    select: { options: trip.cities.map((name, i) => ({ name: name.replace(/,/g, " "), color: DAY_COLORS[i % DAY_COLORS.length] })) },
  });
  return {
    flights: {
      航班: { title: {} },
      類型: { select: { options: [{ name: "去程", color: "orange" }, { name: "回程", color: "blue" }] } },
      日期: { date: {} },
      航空公司: t,
      機型: t,
      出發: t,
      起飛: t,
      抵達: t,
      降落: t,
      飛行時間: t,
      旅客與座位: t,
      行李: t,
    },
    itinerary: {
      景點: { title: {} },
      日期: { date: {} },
      第幾天: {
        select: { options: Array.from({ length: trip.dayCount }, (_, i) => ({ name: `Day ${i + 1}`, color: DAY_COLORS[i % DAY_COLORS.length] })) },
      },
      時間: t,
      城市: cities(),
      當日主題: t,
      交通: {
        multi_select: {
          options: Object.values(trip.transports).map((x) => ({ name: x.label.replace(/,/g, " "), color: TONE_COLORS[x.tone] || "default" })),
        },
      },
      必去: { checkbox: {} },
      說明: t,
    },
    lodging: {
      住宿: { title: {} },
      城市: cities(),
      入住到退房: { date: {} },
      晚數: { number: { format: "number" } },
      地址: t,
      房型: t,
      電話: { phone_number: {} },
      訂房編號: t,
    },
  };
}

const SECTIONS = {
  flights: { title: "航班", icon: "✈️" },
  itinerary: { title: "每日行程", icon: "🗓️" },
  lodging: { title: "住宿", icon: "🏨" },
};

async function createDatabase(client, pageId, kind, properties) {
  const db = await client.request("databases", {
    parent: { type: "page_id", page_id: pageId },
    is_inline: true,
    icon: { type: "emoji", emoji: SECTIONS[kind].icon },
    title: [{ type: "text", text: { content: SECTIONS[kind].title } }],
    properties,
  });
  return plainId(db.id);
}

const append = (client, pageId, children) =>
  client.request(`blocks/${pageId}/children`, { children }, { method: "PATCH" });

/* 在使用者選的頁面底下建立行程頁面：摘要、3 張表（還沒有內容）、準備清單 */
export async function createExportPage(client, parentId, raw) {
  const trip = cleanTrip(raw);
  const all = schemas(trip);

  const page = await client.request("pages", {
    parent: { type: "page_id", page_id: parentId },
    icon: { type: "emoji", emoji: trip.flag || "✈️" },
    properties: { title: { title: rich(trip.title) } },
    children: [
      block.callout([trip.dateRange, trip.summary].filter(Boolean).join("\n") || trip.title, "📅", "blue_background"),
      ...(trip.tagline ? [block.paragraph(trip.tagline, "gray")] : []),
      block.divider(),
      block.heading(`${SECTIONS.flights.icon} ${SECTIONS.flights.title}`),
    ],
  });
  const pageId = page.id;

  /* 表單建立時會接在頁面最後面，所以標題與表單要依序加 */
  const databases = {};
  databases.flights = await createDatabase(client, pageId, "flights", all.flights);
  await append(client, pageId, [
    block.heading(`${SECTIONS.itinerary.icon} ${SECTIONS.itinerary.title}`),
    block.paragraph("小技巧：點表格上方的「＋」可以新增「日曆」或「看板」檢視，依日期或第幾天排列。", "gray"),
  ]);
  databases.itinerary = await createDatabase(client, pageId, "itinerary", all.itinerary);
  await append(client, pageId, [block.heading(`${SECTIONS.lodging.icon} ${SECTIONS.lodging.title}`)]);
  databases.lodging = await createDatabase(client, pageId, "lodging", all.lodging);

  await append(client, pageId, [
    block.heading("🧳 準備清單"),
    ...(trip.checklist.length
      ? trip.checklist.map((c) => block.todo(c.hint ? `${c.text}（${c.hint}）` : c.text, c.checked))
      : [block.paragraph("（沒有項目）", "gray")]),
    block.divider(),
    block.paragraph("由「我的旅行」網站匯出；之後在網站上的修改不會自動同步到這裡。", "gray"),
  ]);

  return { pageId: plainId(pageId), url: page.url, databases };
}

/* ---------- 寫入表格（第二步，分批） ---------- */

const ROWS = {
  flights: (f) => ({
    航班: value.title([f.airline, f.number].filter(Boolean).join(" ") || f.number),
    類型: value.select(f.type),
    日期: value.date(f.date),
    航空公司: value.text(f.airline),
    機型: value.text(f.aircraft),
    出發: value.text([f.from?.code, f.from?.city, f.from?.terminal].filter(Boolean).join(" ")),
    起飛: value.text(f.from?.time),
    抵達: value.text([f.to?.code, f.to?.city, f.to?.terminal].filter(Boolean).join(" ")),
    降落: value.text(f.to?.time),
    飛行時間: value.text(f.duration),
    旅客與座位: value.text(
      (Array.isArray(f.passengers) && f.passengers.length
        ? f.passengers.slice(0, 20).map((p) => [p?.name, p?.seat].filter(Boolean).join(" "))
        : [f.seat]
      )
        .filter(Boolean)
        .join("、")
    ),
    行李: value.text(f.baggage),
  }),
  itinerary: (r) => ({
    景點: value.title(r.title),
    日期: value.date(r.date),
    第幾天: value.select(r.dayLabel),
    時間: value.text(r.time),
    城市: value.select(r.city),
    當日主題: value.text(r.theme),
    交通: value.multi((Array.isArray(r.transport) ? r.transport : []).slice(0, 10)),
    必去: value.check(r.must),
    說明: value.text(r.note),
  }),
  lodging: (l) => ({
    住宿: value.title(l.name),
    城市: value.select(l.city),
    入住到退房: value.date(l.checkIn, l.checkOut),
    晚數: { number: Number.isFinite(l.nights) ? l.nights : null },
    地址: value.text(l.address),
    房型: value.text(l.room),
    電話: value.phone(l.phone),
    訂房編號: value.text(l.bookingNo),
  }),
};

export async function addRows(client, databaseId, kind, rows) {
  const toProps = ROWS[kind];
  if (!toProps) throw new NotionError(400, "不支援這張表");
  if (!Array.isArray(rows) || rows.length > MAX_ROWS_PER_CALL) throw new NotionError(400, `一次最多 ${MAX_ROWS_PER_CALL} 列`);
  const parent = { database_id: toNotionId(databaseId) };
  for (const row of rows) {
    await client.request("pages", { parent, properties: toProps(row && typeof row === "object" ? row : {}) });
  }
  return { added: rows.length };
}
