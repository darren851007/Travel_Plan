/* ============================================================
   匯出至 Notion：把目前這趟行程建立成使用者自己 Notion 裡的一個頁面
   - 還沒綁定 Notion：按鈕直接帶到 Notion 授權畫面，勾選要放行程的頁面（例如「旅行」）後回到這趟行程
   - 頁面內容（伺服器 lib/notion.js 建立）：日期摘要、航班／每日行程／住宿三張表、可打勾的準備清單
   - 匯出是一次性的複製，之後在網站上的修改不會同步到 Notion，可以再匯出一次
   部署在 Cloudflare 時顯示（網站還沒設定 Notion 整合時，按下會說明）
   ============================================================ */
window.Trip = window.Trip || {};

Trip.notionExport = {
  PARENT_KEY: "trip-notion-parent",
  RETURN_KEY: "trip-export-return",
  BATCH: 20,

  init() {
    const $ = (id) => document.getElementById(id);
    this.button = $("trip-export");
    this.dialog = $("notion-export-dialog");
    if (!this.button || !this.dialog) return;
    this.body = $("notion-export-body");
    this.msg = $("notion-export-msg");
    this.primary = $("notion-export-go");
    this.closeButton = $("notion-export-close");

    this.button.addEventListener("click", () => this.start());
    this.closeButton.addEventListener("click", () => this.dialog.close());
    this.primary.addEventListener("click", () => this.action?.());
    this.dialog.addEventListener("cancel", (e) => {
      if (this.busy) e.preventDefault();
    });
    this.dialog.addEventListener("click", (e) => {
      if (e.target === this.dialog && !this.busy) this.dialog.close();
      const copy = e.target.closest("[data-copy]");
      if (copy) this.copy(copy);
      const link = e.target.closest("[data-export]");
      if (link?.dataset.export === "relogin") this.login();
      if (link?.dataset.export === "logout") this.logout();
    });

    this.reopen = this.takeLoginResult();
    Trip.api.onStatus((status) => {
      this.button.hidden = false;
      if (this.reopen && status.configured) {
        const notice = this.reopen;
        this.reopen = null;
        this.open(notice);
      }
    });
  },

  /* 從 Notion 授權頁回來時，網址會帶 ?notion=結果：回到原本那趟行程，再打開匯出視窗 */
  takeLoginResult() {
    const params = new URLSearchParams(location.search);
    const result = params.get("notion");
    if (!result) return null;
    params.delete("notion");
    let back = "";
    try {
      back = sessionStorage.getItem(this.RETURN_KEY) || "";
      sessionStorage.removeItem(this.RETURN_KEY);
    } catch {
      /* 記不住就回首頁 */
    }
    const query = params.toString();
    history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${back || location.hash}`);
    const messages = {
      connected: ["已連結 Notion，選一個頁面就可以匯出", "ok"],
      cancelled: ["已取消 Notion 登入", "pending"],
      error: ["Notion 登入失敗，請再試一次", "error"],
      "not-configured": ["網站尚未設定 Notion 登入", "error"],
    };
    return back ? messages[result] || ["", "pending"] : null;
  },

  /* 按下「匯出至 Notion」：還沒綁定就直接去 Notion 授權，已綁定就選頁面 */
  start() {
    if (!Trip.api.status.configured) {
      this.dialog.showModal();
      this.renderSetup();
      this.message("");
      return;
    }
    if (!Trip.api.status.loggedIn) {
      this.login();
      return;
    }
    this.open();
  },

  /* ---------- 對話框的畫面 ---------- */

  /* 網站還沒有 Notion 整合：一般使用者只看到一句說明；網站擁有者展開後照步驟設定（手機也能完成）
     設定好之後，使用者按按鈕就會直接去 Notion 綁定 */
  renderSetup() {
    const { esc } = Trip.utils;
    const copy = (label, value) => `
      <div class="setup-copy">
        <span class="field__label">${esc(label)}</span>
        <div class="setup-copy__row">
          <input readonly value="${esc(value)}" aria-label="${esc(label)}">
          <button class="btn btn--ghost btn--small" type="button" data-copy="${esc(value)}">複製</button>
        </div>
      </div>`;
    const worker = "travel-plan";
    this.render(
      `<p>這個網站還沒開啟 Notion 匯出，請稍後再試。</p>
       <details class="setup">
         <summary>我是網站管理員：怎麼開啟（手機也可以）</summary>
         <ol class="export-steps">
           <li>打開 <a href="https://app.notion.com/developers/connections" target="_blank" rel="noopener">Notion 開發者頁面</a> → 建立新的「<strong>公開（Public）</strong>」連線，把下面三個網址貼到表單對應的欄位：
             ${copy("Redirect URI", `${location.origin}/api/auth/callback`)}
             ${copy("隱私權政策", `${location.origin}/privacy`)}
             ${copy("使用條款", `${location.origin}/privacy#terms`)}
           </li>
           <li>存好後，Notion 會給你「Client ID」和「Client Secret」</li>
           <li>打開 <a href="https://dash.cloudflare.com/?to=/:account/workers/services/view/${worker}/production/settings" target="_blank" rel="noopener">Cloudflare</a>（Workers 和 Pages → ${worker} → 設定）→「變數和密碼」→ 新增，類型選「<strong>密碼（Secret）</strong>」，新增兩筆：
             ${copy("名稱 1（值貼 Client ID）", "NOTION_CLIENT_ID")}
             ${copy("名稱 2（值貼 Client Secret）", "NOTION_CLIENT_SECRET")}
           </li>
           <li>按「部署」後回到這裡，按下面的「重新檢查」</li>
         </ol>
       </details>`,
      "重新檢查",
      () => this.recheck()
    );
  },

  /* 設定完後重新讀網站狀態；設定好就直接進入綁定 */
  async recheck() {
    this.message("檢查中…", "pending");
    try {
      Object.assign(Trip.api.status, await Trip.api.request("GET", "status"));
    } catch {
      /* 讀不到就維持原狀 */
    }
    if (!Trip.api.status.configured) {
      this.message("網站還沒讀到 Notion 設定，請確認 NOTION_CLIENT_ID、NOTION_CLIENT_SECRET 都設定好了，並已按「部署」", "error");
      return;
    }
    this.dialog.close();
    this.start();
  },

  async open(notice) {
    if (!Trip.state.destination) return;
    this.setBusy(false);
    this.message(...(notice || [""]));
    this.dialog.showModal();
    if (!Trip.api.status.loggedIn) {
      this.renderLoggedOut();
      return;
    }
    this.render(`<p class="field__hint">讀取你分享給「我的旅行」的 Notion 頁面…</p>`, null);
    try {
      this.pages = await Trip.api.request("GET", "notion/pages");
      this.renderChoose();
    } catch (err) {
      if (err.status === 401) {
        Trip.api.status.loggedIn = false;
        this.renderLoggedOut();
      }
      this.message(err.message, "error");
    }
  },

  /* body：對話框內容；label／action：右下角主要按鈕（沒有就隱藏） */
  render(html, label, action) {
    this.body.innerHTML = html;
    this.primary.hidden = !label;
    this.primary.textContent = label || "";
    this.action = action;
  },

  renderLoggedOut() {
    this.render(
      `<p>第一次匯出要先用 Notion 登入。</p>
       <ol class="export-steps">
         <li>按「用 Notion 登入」，到 Notion 的授權畫面</li>
         <li>勾選一個要放行程的頁面（例如「旅行」），按「允許存取」</li>
         <li>回到這裡選那個頁面，按「匯出」</li>
       </ol>`,
      "用 Notion 登入",
      () => this.login()
    );
  },

  renderChoose() {
    const { esc } = Trip.utils;
    const workspace = Trip.api.status.workspace;
    const footer = `<p class="field__hint">${workspace ? `已登入：${esc(workspace)} · ` : ""}<button class="link-button" type="button" data-export="relogin">換頁面或帳號</button> · <button class="link-button" type="button" data-export="logout">登出 Notion</button></p>`;

    if (!this.pages.length) {
      this.render(
        `<p>登入時沒有分享任何頁面給「我的旅行」。請重新登入，在授權畫面勾選一個要放行程的頁面。</p>${footer}`,
        "重新登入並選頁面",
        () => this.login()
      );
      return;
    }

    const saved = this.savedParent();
    const chosen = this.pages.find((p) => p.id === saved) ? saved : this.pages[0].id;
    const trip = Trip.state.trip;
    this.render(
      `<p>要把「${esc(trip.title)}」匯出到哪個頁面底下？</p>
       <div class="export-pages" role="radiogroup" aria-label="選擇 Notion 頁面">
         ${this.pages
           .map(
             (p) => `
         <label class="export-page">
           <input type="radio" name="export-parent" value="${esc(p.id)}" ${p.id === chosen ? "checked" : ""}>
           <span>📄 ${esc(p.title)}</span>
         </label>`
           )
           .join("")}
       </div>
       <p class="field__hint">會建立一個新頁面，裡面有航班、每日行程、住宿三張表和準備清單；之後在網站上的修改不會同步，可以再匯出一次。</p>
       ${footer}`,
      "匯出",
      () => this.run()
    );
  },

  renderDone(result, parentTitle) {
    const { esc } = Trip.utils;
    this.render(
      `<p>已匯出到 Notion 的「${esc(parentTitle)}」底下。</p>
       <p><a class="btn" href="${esc(result.url)}" target="_blank" rel="noopener">在 Notion 打開</a></p>`,
      null
    );
    this.message("匯出完成", "ok");
  },

  /* ---------- 動作 ---------- */

  login() {
    try {
      sessionStorage.setItem(this.RETURN_KEY, location.hash);
    } catch {
      /* 記不住就回首頁 */
    }
    location.href = "/api/auth/login";
  },

  async logout() {
    try {
      await Trip.api.request("POST", "auth/logout", {});
    } catch {
      /* 失敗也當作登出 */
    }
    Trip.api.status.loggedIn = false;
    this.renderLoggedOut();
    this.message("已登出 Notion", "ok");
  },

  async copy(button) {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      button.textContent = "已複製";
    } catch {
      const input = button.parentElement.querySelector("input");
      input.focus();
      input.select();
      button.textContent = "請長按複製";
    }
    setTimeout(() => (button.textContent = "複製"), 1800);
  },

  savedParent() {
    try {
      return localStorage.getItem(this.PARENT_KEY);
    } catch {
      return null;
    }
  },

  async run() {
    const parent = this.body.querySelector('input[name="export-parent"]:checked')?.value;
    const page = this.pages.find((p) => p.id === parent);
    if (!page) return;
    try {
      localStorage.setItem(this.PARENT_KEY, parent);
    } catch {
      /* 下次再選一次也沒關係 */
    }

    const data = this.collect();
    this.setBusy(true);
    try {
      this.message("在 Notion 建立行程頁面…", "pending");
      const result = await Trip.api.request("POST", "notion/export", { parent, trip: data.trip });

      const names = { flights: "航班", itinerary: "每日行程", lodging: "住宿" };
      for (const kind of ["flights", "itinerary", "lodging"]) {
        const rows = data[kind];
        for (let i = 0; i < rows.length; i += this.BATCH) {
          this.message(`寫入${names[kind]} ${Math.min(i + this.BATCH, rows.length)} / ${rows.length}…`, "pending");
          await Trip.api.request("POST", "notion/export-rows", {
            database: result.databases[kind],
            kind,
            rows: rows.slice(i, i + this.BATCH),
          });
        }
      }
      this.setBusy(false);
      this.renderDone(result, page.title);
    } catch (err) {
      this.setBusy(false);
      if (err.status === 401) {
        Trip.api.status.loggedIn = false;
        this.renderLoggedOut();
      }
      this.message(`匯出失敗：${err.message}`, "error");
    }
  },

  /* 把畫面上的行程整理成要匯出的資料（日期、住宿日期都用算好的） */
  collect() {
    const trip = Trip.state.trip;
    const dest = Trip.state.destination;
    const label = (key) => trip.transports[key]?.label || key;

    let done = new Set();
    try {
      done = new Set(JSON.parse(localStorage.getItem(`${Trip.checklist.STORAGE_PREFIX}${trip.id}`)) || []);
    } catch {
      /* 沒有打勾紀錄 */
    }

    return {
      trip: {
        title: trip.title,
        flag: trip.flag,
        tagline: dest.tagline || "",
        dateRange: trip.dateRange,
        summary: `${trip.days.length} 天 ${trip.nights} 夜${trip.cities.length ? ` · ${trip.cities.join(" → ")}` : ""}`,
        cities: trip.cities,
        dayCount: trip.days.length,
        transports: trip.transports,
        checklist: (trip.checklist || []).map((c) => ({ text: c.text, hint: c.hint, checked: done.has(c.id) })),
      },
      /* 有轉機時每一段一列，標題加上「第幾段」 */
      flights: trip.flights.flatMap(({ uid, connections = [], ...f }) => {
        const legs = [f, ...connections];
        return legs.map((leg, k) => ({
          ...(k === 0 ? { ...f, baggage: Trip.addFlight.baggageText(f) } : { ...leg, type: f.type, date: f.date }),
          title: legs.length > 1 ? `${[leg.airline, leg.number].filter(Boolean).join(" ")}（第 ${k + 1} 段）` : "",
        }));
      }),
      itinerary: trip.days.flatMap((day, i) =>
        [...day.items]
          .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
          .map((item) => ({
            title: item.title,
            date: day.date,
            dayLabel: `Day ${i + 1}`,
            time: item.time,
            city: day.city,
            transport: (item.transport || []).map(label),
            must: item.must,
            theme: day.theme,
            note: item.note,
            map: Trip.utils.mapUrl(item.map),
          }))
      ),
      lodging: trip.lodgings.map((l) => ({
        name: l.name,
        city: l.city,
        checkIn: l.checkIn?.date,
        checkOut: l.checkOut?.date,
        nights: l.nights,
        address: l.address,
        room: l.room,
        phone: l.phone,
        bookingNo: l.bookingNo,
      })),
    };
  },

  setBusy(busy) {
    this.busy = busy;
    this.primary.disabled = busy;
    this.closeButton.disabled = busy;
  },

  message(text, type = "pending") {
    Trip.api.renderMessage(this.msg, text, type);
  },
};
