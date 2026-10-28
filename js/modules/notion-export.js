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
      this.render(
        `<p>網站還沒設定 Notion 整合，暫時不能匯出。</p>
         <p class="field__hint">網站管理員需要先在 Notion 建立公開整合，並設定 NOTION_CLIENT_ID、NOTION_CLIENT_SECRET、SESSION_SECRET。</p>`,
        null
      );
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
      flights: trip.flights.map(({ uid, ...f }) => f),
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
