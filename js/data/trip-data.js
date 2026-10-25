/* ============================================================
   旅遊資料 — 所有文字內容都在這裡，換行程只要改這個檔案
   （範例資料：航班、住宿請換成自己的訂位資訊）
   ============================================================ */
window.Trip = window.Trip || {};

Trip.data = {
  brand: "首爾小旅行",
  title: "首爾冬日小旅行",
  subtitle: "5 天 4 夜 · 景福宮、韓屋村與漢江夜景",
  dateRange: "2026.12.18 – 12.22",

  /* 出發時間（含時區），倒數計時用 */
  departure: "2026-12-18T08:20:00+08:00",

  /* 交通方式 → 標籤文字與顏色（tone 對應 css 的 .tone-*） */
  transports: {
    flight: { label: "飛機",     tone: "rose" },
    arex:   { label: "機場快線", tone: "lilac" },
    subway: { label: "地鐵",     tone: "sky" },
    bus:    { label: "公車",     tone: "butter" },
    taxi:   { label: "計程車",   tone: "peach" },
    walk:   { label: "步行",     tone: "mint" },
    cable:  { label: "纜車",     tone: "sand" },
  },

  flights: [
    {
      type: "去程",
      airline: "中華航空",
      number: "CI 160",
      date: "2026-12-18",
      from: { code: "TPE", city: "台北桃園", time: "08:20", terminal: "第一航廈" },
      to:   { code: "ICN", city: "首爾仁川", time: "11:45", terminal: "第一航廈" },
      duration: "2h 25m",
      seat: "32A",
      baggage: "託運 23kg",
    },
    {
      type: "回程",
      airline: "中華航空",
      number: "CI 161",
      date: "2026-12-22",
      from: { code: "ICN", city: "首爾仁川", time: "16:10", terminal: "第一航廈" },
      to:   { code: "TPE", city: "台北桃園", time: "17:55", terminal: "第一航廈" },
      duration: "2h 45m",
      seat: "28C",
      baggage: "託運 23kg",
    },
  ],

  /* 每日行程：must = 必去 */
  days: [
    {
      date: "2026-12-18",
      theme: "抵達首爾 · 弘大散步",
      items: [
        { time: "08:20", title: "桃園機場出發", note: "提早 2 小時到機場報到", transport: ["flight"] },
        { time: "12:30", title: "仁川機場 → 首爾站", note: "搭 AREX 直達車約 43 分鐘", transport: ["arex"] },
        { time: "14:30", title: "弘大入住", note: "放行李、休息一下", transport: ["subway"] },
        { time: "16:00", title: "延南洞 & 京義線林蔭道", note: "小店、咖啡廳一路逛", transport: ["walk"], must: true },
        { time: "19:00", title: "韓式烤肉晚餐", note: "五花肉配大醬湯", transport: ["walk"] },
      ],
    },
    {
      date: "2026-12-19",
      theme: "古宮與韓屋",
      items: [
        { time: "09:30", title: "景福宮", note: "穿韓服免門票，10:00 看守門將換班", transport: ["subway"], must: true },
        { time: "12:00", title: "土俗村蔘雞湯", note: "排隊名店，早點去", transport: ["walk"] },
        { time: "14:00", title: "北村韓屋村", note: "注意住宅區要保持安靜", transport: ["walk"], must: true },
        { time: "16:30", title: "益善洞韓屋街", note: "下午茶、拍照", transport: ["bus"] },
        { time: "19:00", title: "廣藏市場", note: "綠豆煎餅、麻藥紫菜包飯", transport: ["subway"] },
      ],
    },
    {
      date: "2026-12-20",
      theme: "聖水洞 · 漢江夜晚",
      items: [
        { time: "10:00", title: "聖水洞咖啡街", note: "工廠改建的咖啡廳與選物店", transport: ["subway"], must: true },
        { time: "13:00", title: "首爾林", note: "散步、看梅花鹿", transport: ["walk"] },
        { time: "15:30", title: "樂天世界塔", note: "Seoul Sky 觀景台", transport: ["subway"] },
        { time: "19:00", title: "漢江公園炸雞啤酒", note: "汝矣島漢江公園，記得穿暖", transport: ["taxi"], must: true },
      ],
    },
    {
      date: "2026-12-21",
      theme: "明洞 · 南山塔",
      items: [
        { time: "10:00", title: "明洞逛街", note: "美妝、街頭小吃", transport: ["subway"] },
        { time: "14:00", title: "南山纜車", note: "從明洞步行到纜車站", transport: ["walk", "cable"] },
        { time: "15:00", title: "N 首爾塔", note: "看夕陽和首爾夜景", transport: ["cable"], must: true },
        { time: "19:00", title: "東大門", note: "DDP 夜間燈光、宵夜", transport: ["bus"] },
      ],
    },
    {
      date: "2026-12-22",
      theme: "最後採買 · 回家",
      items: [
        { time: "10:00", title: "退房、寄放行李", note: "", transport: ["walk"] },
        { time: "10:30", title: "弘大最後採買", note: "超市零食、伴手禮", transport: ["walk"] },
        { time: "13:00", title: "首爾站 → 仁川機場", note: "預留 3 小時辦理退稅與登機", transport: ["arex"] },
        { time: "16:10", title: "起飛回台北", note: "", transport: ["flight"] },
      ],
    },
  ],

  /* 準備清單（id 不要重複，打勾狀態用 id 記錄） */
  checklist: [
    { id: "passport", text: "護照", hint: "效期 6 個月以上" },
    { id: "entry",    text: "確認入境規定", hint: "K-ETA / 電子入境卡是否需要申請" },
    { id: "flight",   text: "機票訂位確認", hint: "線上報到、選位" },
    { id: "hotel",    text: "住宿訂房確認" },
    { id: "money",    text: "換韓元 / 開通海外刷卡" },
    { id: "tmoney",   text: "T-money 交通卡" },
    { id: "esim",     text: "網卡或 eSIM" },
    { id: "adapter",  text: "轉接頭", hint: "韓國 220V 圓孔插座" },
    { id: "power",    text: "行動電源", hint: "只能隨身帶上機，不可託運" },
    { id: "coat",     text: "羽絨外套、圍巾、手套", hint: "12 月首爾常在零度以下" },
    { id: "medicine", text: "常備藥品" },
    { id: "insurance", text: "旅遊平安險" },
  ],

  lodging: {
    name: "弘大旅店 Hongdae Stay",
    address: "首爾市麻浦區 · 弘大入口站附近（請填入完整地址）",
    checkIn: { date: "2026-12-18", time: "15:00" },
    checkOut: { date: "2026-12-22", time: "11:00" },
    nights: 4,
    room: "雙人房 · 含早餐",
    bookingNo: "HD-20261218",
    phone: "+82 2-0000-0000",
    mapQuery: "弘大入口站",
  },
};
