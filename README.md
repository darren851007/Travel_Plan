# 我的旅行

韓系簡約風格的旅遊行程網頁，手機（含 iPhone Safari）優先。
打開網頁先看到「**我的旅行**」，按「＋ 新增行程」建立旅程，點卡片進入航班、每日行程、準備清單與住宿。

- 行程**存在這台裝置的瀏覽器**；想和別人一起改就建立**共編連結**
- 規劃好之後可以「**匯出至 Notion**」：在自己的 Notion 建立一個整理好的行程頁面（航班、每日行程、住宿三張表＋準備清單）
- **線上版**（GitHub Pages）：https://darren851007.github.io/Travel_Plan/ ，只有網頁功能；
  共同編輯、航班查詢、匯出至 Notion 需要部署到 Cloudflare（見下方「部署」）

## 功能

- **＋ 新增行程**：選國家 → 城市與每個城市的天數 → 出發日與回程日（和天數互相連動）→ 標題 → 封面照片（選填）
- **網頁上可以編輯所有資訊**：
  - 行程資訊：標題、副標、出發日、回程日（延後會在最後加「自由活動」，提早會刪掉最後幾天，有景點時會先提醒）、封面照片
  - 航班：＋ 新增航班（航班號碼自動帶出航空公司、機場依城市預先帶入）、機型、轉機航班（最多再 3 段，卡片顯示轉機機場與停留時間）、多位旅客（姓氏、名字、座位、各自的託運行李：每件公斤數 × 件數；卡片在每位旅客上顯示自己的行李，點旅客就能編輯）、編輯、刪除
  - 每一天：主題與城市（「編輯這一天」）
  - 餐廳：＋ 新增餐廳，選餐別（早餐、午餐、晚餐、咖啡廳、甜點、酒吧、宵夜；沒填時間會帶入常見時間）、★ 必吃；和景點一起依時間排序，時間軸上有 🍴 與餐別標籤
  - 景點：＋ 新增景點、編輯（可換到別天）、刪除、出發時間、抵達時間與預計停留（結束時間＝抵達＋停留，自動算好；時間軸顯示「出發 → 結束」）、照片（行程表上點照片可以放大）、地圖（貼 Google 地圖連結，或輸入地名、地址；行程表上有「📍 地圖」按鈕）
  - 住宿：＋ 新增住宿、編輯、刪除
  - 準備清單：分成「📝 待辦事項」（要訂位、要購買的）與「🧳 行李準備」（要帶的東西）兩張卡片，各自有進度條與＋ 新增項目；編輯時可以改「類別」，存檔後自動移到那張卡片；刪除（打勾狀態各裝置自己記）
- **刪除行程**：「我的旅行」卡片上的「刪除」，或行程頁的「刪除這趟行程」，都要按兩次確認
- **分享給好友**：產生唯讀連結（行程壓縮在連結裡，不經過伺服器），好友可以「加入我的行程」存一份；預設不包含訂房編號、電話、旅客與座位，也不含照片
- **即時共同編輯**（Cloudflare 版）：用 Google 登入後在分享對話框「建立共編行程」，建立的人是擁有者；擁有者替每個人產生**專屬邀請連結**（可以一起編輯，或不勾選就只能看），對方用 Google 登入後連結就綁定他的帳號，轉給別人也打不開；擁有者可以隨時改權限或撤銷。只有擁有者能把行程分享出去。修改 1 秒內出現、顯示誰在線上；「離開共編」只會從自己的清單移除。受邀的人可以用 Google 登入，或只輸入名字以訪客加入（綁定那個瀏覽器）。改版前建立的舊共編連結照舊可用
- **加入需要擁有者同意**（Cloudflare 版）：「分享給好友」要先用 Google 登入；好友按「加入我的行程」、共編裡只能看的成員按「申請一起編輯」都會送出申請（按鈕變成「申請中（點一下取消）」）。擁有者打開那趟行程時跳出對話框，「分享給好友」裡也有申請清單，同意後對方就是共編成員；被拒絕時對方的按鈕回到原本的樣子
- **國家與城市**（Cloudflare 版，需設定 `GEONAMES_USERNAME` 與 D1）：新增行程時國家、城市是可搜尋的選單，全世界的國家與人口一萬五千以上的城市都能選，選了城市會記下最近的機場（常用城市以 `js/data/cities.json` 指定的機場為準，例如京都 → KIX），新增航班時自動帶入。資料由 Cloudflare 排程每月向 GeoNames 更新一次，存在 D1（SQL），網頁查詢只讀 D1；沒有後端（GitHub Pages）時改用 `cities.json` 的常用清單
- **自動帶入航班資料**（Cloudflare 版，需設定 `AERODATABOX_KEY`）：依航班號碼＋航班日期查 AeroDataBox，帶入機型、出發／抵達航廈、起降時間與飛行時間；那天查不到時跳出提示，可以選擇帶入最近一班的資料或自己填
- **匯出至 Notion**（Cloudflare 版，需設定 Notion 公開整合）：行程頁按「匯出至 Notion」→ 用 Notion 登入 → 選一個頁面 → 匯出
- **照片**：封面與景點照片先在瀏覽器縮小成最長邊 1600 像素的 JPEG；自己的行程存在這台裝置（IndexedDB，不上傳），共編行程存在共編房間，大家都看得到
- **每日行程**：日期切換（彈跳動畫）、時間軸、彩色交通標籤、★ 必去
- **航班卡片**顯示航空公司 logo（依航班號碼代碼，例如 CI、BR；清單在 `js/data/airlines.js`，圖片由 pics.avs.io 提供）
- 插圖會輕輕動，支援「減少動態效果」

## 匯出到 Notion 的頁面

```
📄 旅行（登入時分享的頁面，可以選）
  └ 🇰🇷 韓國冬日小旅行
       📅 2026.12.18 – 12.22 · 5 天 4 夜 · 首爾 → 釜山
       ✈️ 航班      表格：航班、類型、日期、航空公司、機型、出發／起飛、抵達／降落、飛行時間、旅客與座位、行李
       🗓️ 每日行程  表格：景點、類型（景點／餐廳）、餐別、日期、第幾天（每天不同顏色）、時間（出發）、抵達時間、停留、結束時間、城市、當日主題、交通（彩色）、必去、說明、地圖連結
       🏨 住宿      表格：住宿、城市、入住到退房（日期區間）、晚數、地址、房型、電話、訂房編號
       ✅ 準備清單  分成「待辦事項」「行李準備」兩段，可以打勾（網頁上打過勾的會一起帶過去）
```

- 每日行程表格可以在 Notion 新增「日曆」或「看板」檢視，依日期或第幾天排列
- 匯出是一次性的複製，之後在網站上的修改不會同步，可以再匯出一次（會建立新頁面）

## 架構

```
iPhone / 電腦瀏覽器 ──▶ Cloudflare Worker（網頁＋/api）
                          ├ /api/auth、/api/notion ──▶ Notion API（匯出：用每個人自己的授權）
                          ├ /api/flights ──▶ AeroDataBox（查航班）
                          └ /api/rooms ──▶ 共編房間（Durable Object，WebSocket 即時推播、照片）
```

- 每個人的 Notion 授權**加密後存在自己裝置的 Cookie**（HttpOnly），網站不保存任何人的授權
- 自己的行程存在每個人自己的瀏覽器（localStorage）；共編行程存在共編房間，只有拿到連結的人能打開

## 資料夾結構

```
index.html              頁面骨架：我的旅行 + 行程畫面 + 對話框
privacy.html            隱私權政策與使用條款（Notion 公開整合需要）
css/                    tokens（顏色字型）、base、layout、components、motion
js/
  data/config.js        共用設定：交通標籤、共用準備清單、預設出發日
  data/cities.json      城市與國家清單（含機場代碼、國旗）
  data/airlines.js      航空公司代碼與名稱
  core/                 utils、api（呼叫伺服器）、builder（組行程）、state、router、art（SVG 插圖）、
                        local-trips（存在這台裝置的行程）、editor（編輯：這台裝置或共編房間）、
                        photos（封面與景點照片）、share（分享連結）、collab（共編行程與即時連線）
  modules/              picker、hero、countdown、flights、itinerary、checklist、lodging、
                        new-trip（新增行程）、add-item（景點）、add-flight（航班）、
                        edit-dialog（通用編輯對話框）、trip-delete（刪除行程）、
                        share-panel（分享與共編）、notion-export（匯出至 Notion）
  main.js               進入點
server/                 Cloudflare Worker
  index.js              進入點：/api 路由，其餘交給網頁檔案
  room.js               共編房間（Durable Object：保存行程與照片、WebSocket 推播、版本衝突）
  api/status.js         網站開了哪些功能、是否已用 Notion 登入
  api/rooms.js          建立／讀取共編行程、WebSocket 連線、照片、專屬邀請與權限
  api/auth/google/      Google 登入（共編行程的擁有者與受邀成員）
  api/flights.js        查詢真實航班
  api/auth/             login、callback、logout（Notion 登入）
  api/notion/           pages（選頁面）、export（建立匯出頁面、分批寫入表格）
lib/                    Worker 共用：notion（匯出頁面設計）、flight-lookup、session（加密 Cookie）、http
wrangler.toml           Worker 設定（網頁檔案、Durable Object）
scripts/build.mjs       打包網頁到 dist/site（只含網頁檔案）
```

## 部署

1. 註冊 [Cloudflare](https://dash.cloudflare.com/sign-up)，在專案資料夾執行 `npx wrangler login`
2. `npm install`，然後 `npm run deploy`，取得網址（目前是 `https://travel-plan.darrentrip.workers.dev`）
   - 到這一步就能用：自己的行程、分享
3. 即時共同編輯要用 Google 登入（免費）：到 [Google Cloud Console](https://console.cloud.google.com/) 建一個專案
   - 「API 和服務」→「OAuth 同意畫面」：使用者類型選「外部」，填應用程式名稱與 Email；只需要 `openid`、`email`、`profile`（不需要 Google 審核）。設定完按「發布應用程式」，否則只有測試使用者名單上的帳號能登入
   - 「憑證」→「建立憑證」→「OAuth 用戶端 ID」→ 類型「網頁應用程式」，已授權的重新導向 URI：`https://travel-plan.darrentrip.workers.dev/api/auth/google/callback`（本機測試再加 `http://localhost:8787/api/auth/google/callback`）
   - 把用戶端 ID、用戶端密鑰設成 Cloudflare 密鑰 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`（方法同下面第 5 步）
4. 匯出至 Notion：到 [Notion 開發者頁面](https://app.notion.com/developers/connections) 建立「**公開（Public）**」連線
   - Redirect URI：`https://travel-plan.darrentrip.workers.dev/api/auth/callback`
   - 隱私權政策／使用條款：`https://travel-plan.darrentrip.workers.dev/privacy`、`https://travel-plan.darrentrip.workers.dev/privacy#terms`
   - 權限：讀取內容、插入內容
5. 把 Notion 給的 Client ID、Client Secret 設成 Cloudflare 密鑰（兩種方法擇一，手機用第一種）：
   - **Cloudflare 網頁**：Workers 和 Pages → travel-plan → 設定 →「變數和密碼」→ 新增兩筆「密碼（Secret）」：`NOTION_CLIENT_ID`、`NOTION_CLIENT_SECRET`，按部署
   - **電腦終端機**：`npx wrangler secret put NOTION_CLIENT_ID`、`npx wrangler secret put NOTION_CLIENT_SECRET`
   - 選填：`SESSION_SECRET`（加密登入 Cookie 用；不設就從 Client Secret 衍生）、`AERODATABOX_KEY`（自動帶入機型與航廈）
6. 國家與城市（選填）：到 [GeoNames](https://www.geonames.org/login) 註冊，在[帳號頁](https://www.geonames.org/manageaccount)開啟「Free Web Services」，把使用者名稱設成密鑰 `GEONAMES_USERNAME`
   - 建立 D1：`npx wrangler d1 create travel-places`，把 `database_id` 填進 `wrangler.toml`，再執行 `npx wrangler d1 migrations apply travel-places --remote` 建立資料表
   - 部署後排程每分鐘更新一個國家，約 4～5 小時抓完；想立刻全部抓完可以在 `.dev.vars` 加上 `GEONAMES_USERNAME` 後執行 `node scripts/load-places.mjs`
   - 還沒設定時，網站的「匯出至 Notion」視窗裡也有「我是網站管理員」的步驟說明

之後修改程式只要 `npm run deploy`。

本機測試：複製 `.dev.vars.example` 為 `.dev.vars` 填入數值，執行 `npm run dev`（http://localhost:8787，含共編房間）。

## 使用者怎麼用

1. 打開網址 → 「＋ 新增行程」建立一趟旅程，在行程頁新增航班、景點、住宿
2. 要一起規劃：用 Google 登入 →「分享給好友」→「建立共編行程」→ 替每位旅伴各產生一條專屬邀請連結傳給他
3. 規劃好了：「匯出至 Notion」→ 用 Notion 登入，授權時勾選一個頁面（例如「旅行」）→ 選它 → 匯出
4. iPhone：Safari 分享 → 加入主畫面，就能像 App 一樣開啟
