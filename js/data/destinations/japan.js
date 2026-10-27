/* ============================================================
   行程：日本（東京）— 航班、住宿為範例資料
   days 依序是 Day 1、Day 2…；city 決定住宿日期與機場
   ============================================================ */
window.Trip = window.Trip || {};
Trip.destinations = Trip.destinations || [];

Trip.destinations.push({
  id: "japan",
  name: "日本",
  flag: "🇯🇵",
  title: "東京冬日小旅行",
  tagline: "淺草、澀谷與東京鐵塔燈光",
  art: "heroTokyo",
  startDate: "2027-01-22",

  flights: {
    outbound: {
      airline: "長榮航空", number: "BR 198",
      from: { code: "TPE", city: "台北桃園", time: "08:50", terminal: "第二航廈" },
      to:   { code: "NRT", city: "東京成田", time: "13:10", terminal: "第一航廈" },
      duration: "3h 20m", seat: "41A", baggage: "託運 23kg",
    },
    inbound: {
      airline: "長榮航空", number: "BR 197",
      from: { code: "NRT", city: "東京成田", time: "14:30", terminal: "第一航廈" },
      to:   { code: "TPE", city: "台北桃園", time: "17:35", terminal: "第二航廈" },
      duration: "4h 05m", seat: "38C", baggage: "託運 23kg",
    },
  },

  days: [
    {
      city: "東京",
      theme: "抵達東京 · 淺草夜晚",
      items: [
        { time: "08:50", title: "桃園機場出發", note: "提早 2 小時到機場報到", transport: ["flight"] },
        { time: "14:00", title: "成田機場 → 上野", note: "搭 Skyliner 約 41 分鐘", transport: ["arex"] },
        { time: "15:00", title: "上野入住", note: "放行李、休息一下", transport: ["walk"] },
        { time: "16:30", title: "淺草寺 · 雷門", note: "仲見世通吃人形燒", transport: ["subway"], must: true },
        { time: "19:00", title: "晴空塔夜景", note: "從隅田川散步過去", transport: ["walk"] },
      ],
    },
    {
      city: "東京",
      theme: "原宿 · 澀谷",
      items: [
        { time: "10:00", title: "明治神宮", note: "早上人少很清幽", transport: ["train"] },
        { time: "12:00", title: "原宿竹下通", note: "可麗餅、古著", transport: ["walk"] },
        { time: "15:00", title: "SHIBUYA SKY", note: "夕陽時段建議先預約", transport: ["train"], must: true },
        { time: "18:00", title: "澀谷十字路口", note: "從星巴克二樓往下看", transport: ["walk"] },
      ],
    },
    {
      city: "東京",
      theme: "築地 · 銀座 · 東京鐵塔",
      items: [
        { time: "09:30", title: "築地場外市場", note: "玉子燒、海鮮丼", transport: ["subway"] },
        { time: "12:30", title: "銀座散步", note: "伊東屋文具、百貨", transport: ["walk"] },
        { time: "16:00", title: "東京鐵塔", note: "傍晚點燈最漂亮", transport: ["subway"], must: true },
        { time: "19:00", title: "六本木夜景", note: "六本木 Hills 展望台", transport: ["walk"] },
      ],
    },
    {
      city: "東京",
      theme: "鎌倉 · 江之島",
      items: [
        { time: "09:00", title: "搭電車往鎌倉", note: "JR 橫須賀線約 1 小時", transport: ["train"] },
        { time: "10:30", title: "鶴岡八幡宮", note: "小町通邊走邊吃", transport: ["walk"] },
        { time: "13:00", title: "江之電 · 鎌倉高校前", note: "灌籃高手平交道", transport: ["train"], must: true },
        { time: "15:30", title: "江之島", note: "看海、吃魩仔魚丼", transport: ["walk"] },
      ],
    },
    {
      city: "東京",
      theme: "最後採買 · 回家",
      items: [
        { time: "09:30", title: "退房", note: "", transport: ["walk"] },
        { time: "10:00", title: "阿美橫丁採買", note: "藥妝、零食", transport: ["walk"] },
        { time: "11:30", title: "上野 → 成田機場", note: "搭 Skyliner，預留 2.5 小時登機", transport: ["arex"] },
        { time: "14:30", title: "起飛回台北", note: "", transport: ["flight"] },
      ],
    },
  ],

  lodgings: [
    {
      city: "東京",
      name: "上野旅店 Ueno Stay",
      address: "東京都台東區 · 上野站附近（請填入完整地址）",
      room: "雙人房",
      checkInTime: "15:00",
      checkOutTime: "10:00",
      bookingNo: "UE-20270122",
      phone: "+81 3-0000-0000",
      mapQuery: "上野站",
    },
  ],

  checklist: [
    { id: "entry",   text: "填寫 Visit Japan Web", hint: "入境審查、海關 QR Code" },
    { id: "money",   text: "換日圓 / 開通海外刷卡" },
    { id: "transit", text: "Suica / PASMO 交通卡", hint: "也可以加到手機錢包" },
  ],
});
