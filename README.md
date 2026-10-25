# 首爾冬日小旅行

韓系簡約風格的旅遊行程網頁。純 HTML / CSS / JavaScript，不需要安裝任何東西。

- **本機開啟**：直接雙擊 `index.html`
- **線上開啟**：GitHub Pages（推上 `main` 後自動更新）

## 資料夾結構

```
index.html              頁面骨架（選單、首頁、航班、行程、準備清單）
css/
  tokens.css            設計變數：顏色、字型、框線、圓角
  base.css              基礎樣式與 reset
  layout.css            版面：頂端選單、區塊、格線、頁尾
  components.css        元件：卡片、倒數、航班、時間軸、清單、住宿、插圖顏色
  motion.css            動畫與「減少動態效果」設定
js/
  data/trip-data.js     ★ 所有旅遊內容（換行程只要改這裡）
  core/utils.js         共用工具（日期格式、HTML 跳脫）
  core/art.js           SVG 插圖（南山塔、景福宮、漢江、飛機、地鐵…）
  modules/nav.js        選單捲動高亮
  modules/countdown.js  出發倒數
  modules/flights.js    航班卡片
  modules/itinerary.js  每日行程（日期切換 + 時間軸）
  modules/checklist.js  可打勾的待辦清單（存在瀏覽器 localStorage）
  modules/lodging.js    住宿資訊
  main.js               進入點，依序啟動各模組
```

## 常見修改

| 想改什麼 | 改哪裡 |
|---|---|
| 標題、出發時間、航班、行程、清單、住宿 | `js/data/trip-data.js` |
| 新增交通方式 | `trip-data.js` 的 `transports`，顏色用 `css/components.css` 的 `.tone-*` |
| 顏色、框線粗細、字型 | `css/tokens.css` |
| 插圖 | `js/core/art.js` |

> 航班與住宿目前是範例資料，請換成自己的訂位資訊。
