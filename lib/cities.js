/* ============================================================
   城市清單 — 資料在 js/data/cities.json（網頁與 Cloudflare Functions 共用）
   選了城市後，同步時會自動補上機場代碼、國旗、插圖等空白資料
   想加城市：在 cities.json 加一列，重新部署即可
   ============================================================ */
import data from "../js/data/cities.json" with { type: "json" };

/* art：有專屬首頁插圖的城市；沒有的用通用插圖 */
export const CITIES = data.cities;

/* 國家：網頁代號、國旗、Notion 選單顏色（國家頁面的標題對應這裡的名稱） */
export const COUNTRIES = data.countries;

export const cityOption = (city) => ({ name: city.name, color: COUNTRIES[city.country]?.color || "default" });

export const findCity = (name) => CITIES.find((c) => c.name === name);
