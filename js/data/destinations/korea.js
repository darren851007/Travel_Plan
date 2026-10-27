/* ============================================================
   行程：韓國（首爾 → 釜山）— 航班、住宿為範例資料
   days 依序是 Day 1、Day 2…；city 決定住宿日期與機場
   ============================================================ */
window.Trip = window.Trip || {};
Trip.destinations = Trip.destinations || [];

Trip.destinations.push({
  id: "korea",
  name: "韓國",
  flag: "🇰🇷",
  title: "韓國冬日小旅行",
  tagline: "首爾古宮、釜山海景",
  art: "heroSeoul",
  startDate: "2026-12-18",

  flights: {
    outbound: {
      airline: "中華航空", number: "CI 160",
      from: { code: "TPE", city: "台北桃園", time: "08:20", terminal: "第一航廈" },
      to:   { code: "ICN", city: "首爾仁川", time: "11:45", terminal: "第一航廈" },
      duration: "2h 25m", seat: "32A", baggage: "託運 23kg",
    },
    inbound: {
      airline: "中華航空", number: "CI 189",
      from: { code: "PUS", city: "釜山金海", time: "13:30", terminal: "國際線" },
      to:   { code: "TPE", city: "台北桃園", time: "15:10", terminal: "第一航廈" },
      duration: "2h 40m", seat: "26C", baggage: "託運 23kg",
    },
  },

  days: [
    {
      city: "首爾",
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
      city: "首爾",
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
      city: "首爾",
      theme: "明洞 · 南山塔",
      items: [
        { time: "10:00", title: "明洞逛街", note: "美妝、街頭小吃", transport: ["subway"] },
        { time: "14:00", title: "南山纜車", note: "從明洞步行到纜車站", transport: ["walk", "cable"] },
        { time: "15:00", title: "N 首爾塔", note: "看夕陽和首爾夜景", transport: ["cable"], must: true },
        { time: "19:00", title: "東大門", note: "DDP 夜間燈光、宵夜", transport: ["bus"] },
      ],
    },
    {
      city: "釜山",
      theme: "搭 KTX 到釜山 · 海雲台",
      items: [
        { time: "08:30", title: "首爾站搭 KTX", note: "約 2.5 小時，記得先訂票", transport: ["train"] },
        { time: "11:30", title: "西面入住", note: "先寄放行李", transport: ["subway"] },
        { time: "13:30", title: "海雲台海岸列車", note: "Blue Line Park，建議先預約", transport: ["train"], must: true },
        { time: "16:00", title: "青沙浦踏石展望台", note: "腳下就是海", transport: ["walk"] },
        { time: "18:30", title: "廣安里海灘", note: "看廣安大橋點燈", transport: ["subway"], must: true },
      ],
    },
    {
      city: "釜山",
      theme: "甘川洞 · 南浦洞",
      items: [
        { time: "10:00", title: "甘川文化村", note: "彩色房子、小王子雕像", transport: ["bus"], must: true },
        { time: "13:00", title: "BIFF 廣場", note: "黑糖餅、魚板", transport: ["bus"] },
        { time: "15:00", title: "札嘎其市場", note: "韓國最大的海鮮市場", transport: ["walk"] },
        { time: "18:00", title: "釜山塔", note: "龍頭山公園看夜景", transport: ["walk"] },
      ],
    },
    {
      city: "釜山",
      theme: "最後採買 · 回家",
      items: [
        { time: "09:00", title: "退房", note: "", transport: ["walk"] },
        { time: "09:30", title: "西面地下街採買", note: "伴手禮、零食", transport: ["walk"] },
        { time: "11:00", title: "西面 → 金海機場", note: "預留 2.5 小時辦理退稅與登機", transport: ["subway", "train"] },
        { time: "13:30", title: "起飛回台北", note: "", transport: ["flight"] },
      ],
    },
  ],

  /* 住宿依城市自動算入住／退房日 */
  lodgings: [
    {
      city: "首爾",
      name: "弘大旅店 Hongdae Stay",
      address: "首爾市麻浦區 · 弘大入口站附近（請填入完整地址）",
      room: "雙人房 · 含早餐",
      checkInTime: "15:00",
      checkOutTime: "11:00",
      bookingNo: "HD-20261218",
      phone: "+82 2-0000-0000",
      mapQuery: "弘大入口站",
    },
    {
      city: "釜山",
      name: "西面旅店 Seomyeon Stay",
      address: "釜山市釜山鎮區 · 西面站附近（請填入完整地址）",
      room: "雙人房 · 海景",
      checkInTime: "15:00",
      checkOutTime: "11:00",
      bookingNo: "SM-20261221",
      phone: "+82 51-000-0000",
      mapQuery: "西面站 釜山",
    },
  ],

  checklist: [
    { id: "entry",   text: "確認入境規定", hint: "K-ETA / 電子入境卡是否需要申請" },
    { id: "money",   text: "換韓元 / 開通海外刷卡" },
    { id: "transit", text: "T-money 交通卡" },
    { id: "ktx",     text: "預訂 KTX 首爾 → 釜山", hint: "Korail 官網或 App" },
    { id: "adapter", text: "轉接頭", hint: "韓國 220V 圓孔插座" },
  ],
});
