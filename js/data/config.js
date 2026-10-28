/* ============================================================
   共用設定 — 所有行程共用的交通標籤、準備清單、預設出發日
   每趟行程是使用者自己建立的（js/core/local-trips.js），或加入的共編行程（js/core/collab.js）
   ============================================================ */
window.Trip = window.Trip || {};

Trip.config = {
  /* 行程沒填出發日時使用（台灣時間） */
  startDate: "2026-12-18",
  originTimezone: "+08:00",

  /* 餐廳的餐別 → 標籤顏色、預設開始時間與停留分鐘（新增餐廳時選了餐別、還沒填時間就帶入） */
  meals: [
    { label: "早餐",   tone: "butter", time: "08:00", minutes: 45 },
    { label: "午餐",   tone: "peach",  time: "12:00", minutes: 60 },
    { label: "晚餐",   tone: "rose",   time: "18:30", minutes: 90 },
    { label: "咖啡廳", tone: "sand",   time: "15:00", minutes: 60 },
    { label: "甜點",   tone: "mint",   time: "16:00", minutes: 45 },
    { label: "酒吧",   tone: "lilac",  time: "21:00", minutes: 120 },
    { label: "宵夜",   tone: "sky",    time: "22:30", minutes: 60 },
  ],

  /* 交通方式 → 標籤文字與顏色（tone 對應 css 的 .tone-*） */
  transports: {
    flight: { label: "飛機",     tone: "rose" },
    arex:   { label: "機場快線", tone: "lilac" },
    subway: { label: "地鐵",     tone: "sky" },
    train:  { label: "電車",     tone: "green" },
    bus:    { label: "公車",     tone: "butter" },
    taxi:   { label: "計程車",   tone: "peach" },
    walk:   { label: "步行",     tone: "mint" },
    cable:  { label: "纜車",     tone: "sand" },
  },

  /* 準備清單：前段 + 各國專屬 + 後段
     group：todo＝待辦事項（要訂位、要購買的）、packing＝行李準備（要帶的東西）；沒寫就是 todo */
  checklistBefore: [
    { id: "passport", text: "護照", hint: "效期 6 個月以上", group: "packing" },
    { id: "flight",   text: "機票訂位確認", hint: "線上報到、選位" },
    { id: "hotel",    text: "住宿訂房確認" },
  ],
  checklistAfter: [
    { id: "esim",      text: "網卡或 eSIM" },
    { id: "insurance", text: "旅遊平安險" },
    { id: "power",     text: "行動電源", hint: "只能隨身帶上機，不可託運", group: "packing" },
    { id: "coat",      text: "羽絨外套、圍巾、手套", hint: "12 月常在零度上下", group: "packing" },
    { id: "medicine",  text: "常備藥品", group: "packing" },
  ],

  /* 準備清單的兩張卡片 */
  checklistGroups: [
    { key: "todo",    title: "待辦事項", icon: "📝" },
    { key: "packing", title: "行李準備", icon: "🧳" },
  ],
};
