/* ============================================================
   城市清單 — Notion「行程」「住宿」表的城市下拉選單
   選了城市後，同步時會自動補上機場代碼、國旗、插圖等空白資料
   想加城市：在這裡加一列，重新部署後，新建立的國家頁面就會有這個選項
   ============================================================ */

/* art：有專屬首頁插圖的城市；沒有的用通用插圖 */
export const CITIES = [
  { name: "首爾",     id: "seoul",     country: "韓國",   airport: "ICN", art: "heroSeoul" },
  { name: "釜山",     id: "busan",     country: "韓國",   airport: "PUS", art: "heroBusan" },
  { name: "濟州",     id: "jeju",      country: "韓國",   airport: "CJU" },
  { name: "大邱",     id: "daegu",     country: "韓國",   airport: "TAE" },
  { name: "東京",     id: "tokyo",     country: "日本",   airport: "NRT", art: "heroTokyo" },
  { name: "大阪",     id: "osaka",     country: "日本",   airport: "KIX" },
  { name: "京都",     id: "kyoto",     country: "日本",   airport: "KIX" },
  { name: "福岡",     id: "fukuoka",   country: "日本",   airport: "FUK" },
  { name: "札幌",     id: "sapporo",   country: "日本",   airport: "CTS" },
  { name: "沖繩",     id: "okinawa",   country: "日本",   airport: "OKA" },
  { name: "名古屋",   id: "nagoya",    country: "日本",   airport: "NGO" },
  { name: "曼谷",     id: "bangkok",   country: "泰國",   airport: "BKK" },
  { name: "清邁",     id: "chiangmai", country: "泰國",   airport: "CNX" },
  { name: "峴港",     id: "danang",    country: "越南",   airport: "DAD" },
  { name: "河內",     id: "hanoi",     country: "越南",   airport: "HAN" },
  { name: "胡志明市", id: "hochiminh", country: "越南",   airport: "SGN" },
  { name: "新加坡",   id: "singapore", country: "新加坡", airport: "SIN" },
  { name: "香港",     id: "hongkong",  country: "香港",   airport: "HKG" },
  { name: "澳門",     id: "macau",     country: "澳門",   airport: "MFM" },
  { name: "峇里島",   id: "bali",      country: "印尼",   airport: "DPS" },
];

/* 國家：網頁代號、國旗、選單顏色（Notion 國家頁面的標題對應這裡的名稱） */
export const COUNTRIES = {
  韓國:   { id: "korea",     flag: "🇰🇷", color: "blue" },
  日本:   { id: "japan",     flag: "🇯🇵", color: "red" },
  泰國:   { id: "thailand",  flag: "🇹🇭", color: "yellow" },
  越南:   { id: "vietnam",   flag: "🇻🇳", color: "green" },
  新加坡: { id: "singapore", flag: "🇸🇬", color: "pink" },
  香港:   { id: "hongkong",  flag: "🇭🇰", color: "purple" },
  澳門:   { id: "macau",     flag: "🇲🇴", color: "orange" },
  印尼:   { id: "indonesia", flag: "🇮🇩", color: "brown" },
};

export const cityOption = (city) => ({ name: city.name, color: COUNTRIES[city.country]?.color || "default" });

export const findCity = (name) => CITIES.find((c) => c.name === name);
