# 我的旅行

韓系簡約風格的旅遊行程網頁，手機（含 iPhone Safari）優先。
打開網頁先看到「**選擇行程**」：每個國家一趟旅程（可以跨多個城市），點卡片進入航班、每日行程、準備清單與住宿。

每個人用**自己的 Notion 帳號登入**，看到的是自己 Notion 裡的旅行；不需要 Claude 帳號。
沒登入時顯示韓國、日本兩個範例。

- **線上版**（GitHub Pages）：https://darren851007.github.io/Travel_Plan/
  可以新增、刪除行程與景點，資料**存在這台裝置的瀏覽器**；
  要用 Notion 登入、把行程存到 Notion，需要部署到 Cloudflare（見下方「部署」）

## 功能

- **選擇行程**：行程卡片（插圖、國家、城市、日期、天數、出發倒數）；網址 `#/korea` 可加書籤
- **＋ 新增行程**：選國家 → 城市與每個城市的天數 → 出發日 → 標題（含每天的預設行程、每城市住宿、去回程航班）
- **＋ 新增景點**：在某一天加一筆行程（時間、名稱、城市、交通、必去、說明）
- **刪除行程**：「我的旅行」卡片上的「刪除」，或行程頁的「刪除這趟行程」，都要按兩次確認
- 以上在**登入 Notion 時存到 Notion**（刪除＝移到 Notion 垃圾桶，30 天內可還原），否則**存在這台裝置**
- 內建範例（韓國、日本）也能刪除：只在這台裝置隱藏，「我的旅行」頁按「還原範例行程」可以找回；範例不能新增景點
- 先在這台裝置建立的行程，登入 Notion 後可以按「**把這台裝置的行程存到 Notion**」一次上傳（Notion 已有同國家頁面的會先保留在這台裝置）
- **每日行程**：日期切換（彈跳動畫）、時間軸、彩色交通標籤、★ 必去
- **準備清單**：可打勾，依行程分開記在瀏覽器
- **住宿**：每個城市一間，入住／退房日依行程自動計算
- **航班卡片**顯示航空公司 logo（依航班號碼代碼，例如 CI、BR；清單在 `js/data/airlines.js`，圖片由 pics.avs.io 提供）
- 插圖會輕輕動，支援「減少動態效果」

## 架構

```
iPhone / 電腦瀏覽器 ──▶ Cloudflare Pages（網頁）
                          │ /api/*（Cloudflare Functions，轉接 Notion）
                          ▼
                       Notion API（用每個人自己的授權）
```

- 瀏覽器不能直接呼叫 Notion API，所以由 Cloudflare Functions 轉接
- 每個人的 Notion 授權**加密後存在自己裝置的 Cookie**（HttpOnly），網站不保存任何人的授權或行程
- 同步的行程存在每個人自己的瀏覽器（localStorage）

## 資料夾結構

```
index.html              頁面骨架：選擇行程畫面 + 行程畫面 + 對話框
privacy.html            隱私權政策與使用條款（Notion 公開整合需要）
css/                    tokens（顏色字型）、base、layout、components、motion
js/
  data/config.js        共用設定：交通標籤、共用準備清單、預設出發日
  data/destinations/    內建範例（korea.js、japan.js）
  data/cities.json      城市與國家清單（網頁與 Functions 共用）
  core/                 utils、builder（組行程）、state、router、art（SVG 插圖）、
                        notion-cache（Notion 同步的行程）、local-trips（存在這台裝置的行程）
  modules/              picker、hero、countdown、flights、itinerary、checklist、lodging、
                        notion-panel（登入與同步）、new-trip（新增行程）、add-item（新增景點）、
                        trip-delete（刪除行程，卡片與行程頁共用）
  main.js               進入點
functions/api/          Cloudflare Functions
  status.js             登入狀態
  auth/                 login、callback、logout（Notion OAuth）
  notion/               pages、countries、country、create-country、seed、add-item、archive-country
lib/                    Functions 共用：notion（表單設計與讀寫）、session（加密 Cookie）、http、cities
scripts/build.mjs       打包網頁到 dist/site（只含網頁檔案）
```

## 部署（第一次）

1. 註冊 [Cloudflare](https://dash.cloudflare.com/sign-up)，在專案資料夾執行 `npx wrangler login`
2. `npm install`，然後 `npm run deploy`，取得網址（例如 `https://travel-plan.pages.dev`）
3. 到 [Notion 整合頁面](https://www.notion.so/profile/integrations) 建立「**公開**」整合：
   - Redirect URI：`https://<你的網址>/api/auth/callback`
   - 隱私權政策／使用條款：`https://<你的網址>/privacy`、`https://<你的網址>/privacy#terms`
   - 權限：讀取內容、更新內容、插入內容
4. 設定 Cloudflare 密鑰（指令會請你貼上數值）：
   ```
   npx wrangler pages secret put NOTION_CLIENT_ID --project-name travel-plan
   npx wrangler pages secret put NOTION_CLIENT_SECRET --project-name travel-plan
   npx wrangler pages secret put SESSION_SECRET --project-name travel-plan   # 隨機 48 字元以上，例如 openssl rand -base64 48
   ```
5. 再執行一次 `npm run deploy`

之後修改程式只要 `npm run deploy`。

本機測試：複製 `.dev.vars.example` 為 `.dev.vars` 填入數值，執行 `npm run dev`（http://localhost:8788）。

## 使用者怎麼用

1. 打開網址 → 最下面「Notion 連結」→ **用 Notion 登入**
2. Notion 授權頁選一個頁面分享（例如「Travel」），國家行程會放在它底下
3. 第一次可以按 **建立範例國家頁面**，或在選擇行程畫面按 **＋ 新增行程**
4. 在 Notion 修改後，回網頁按 **從 Notion 同步**；也可以在網頁直接 **＋ 新增景點**
5. iPhone：Safari 分享 → 加入主畫面，就能像 App 一樣開啟

## Notion 結構：一個國家一個頁面

```
📄 Travel（登入時分享的頁面）
  ├ 📄 🇰🇷 韓國     ← 一趟旅程，可以有多個城市
  │    ⚙️ 旅程設定  ✈️ 航班  🗓️ 行程  🏨 住宿  ✅ 準備清單
  └ 📄 🇯🇵 日本
```

- 每個子頁面＝一個國家，頁面標題就是國家名稱
- 新增國家：網頁按「＋ 新增行程」，或在 Notion 複製一個國家頁面改名後同步
- 表單要直接放在國家頁面裡，標題前面可以加表情符號

| 表單 | 重點欄位 |
|---|---|
| ⚙️ 旅程設定（只看第一列，可省略） | 名稱（標題）、副標、出發日、插圖、代號、排序 |
| ✈️ 航班（一筆去程、一筆回程） | 航班、類型（去程／回程）、出發／抵達的機場、城市、時間、航廈；機場空白時依城市補上 |
| 🗓️ 行程（一列＝一個行程點） | 名稱、**第幾天**（最大的數字＝天數）、城市、當日主題、時間（09:30）、說明、交通、必去 |
| 🏨 住宿（每個城市一間） | 名稱、城市（入住／退房日自動計算）、地址、房型、入住／退房時間、訂房編號、電話、地圖搜尋 |
| ✅ 準備清單 | 項目、說明、排序 |

城市清單在 `js/data/cities.json`（23 個城市，含機場代碼、國旗）。新增交通方式時，Notion 的選項名稱要和 `js/data/config.js` 的 `transports` 標籤一致。

> 航班與住宿的範例是假資料，請換成自己的訂位資訊。
