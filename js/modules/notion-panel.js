/* ============================================================
   Notion 連結面板：用 Notion 登入、選擇上層頁面、同步、建立範例
   每個人登入自己的 Notion，行程只存在自己的瀏覽器
   只有部署在 Cloudflare（有 /api）時才會顯示
   ============================================================ */
window.Trip = window.Trip || {};

Trip.notionPanel = {
  PARENT_KEY: "trip-notion-parent",
  KINDS: ["settings", "flights", "itinerary", "lodging", "checklist"],
  KIND_NAMES: { settings: "旅程設定", flights: "航班", itinerary: "行程", lodging: "住宿", checklist: "準備清單" },

  async init() {
    this.section = document.getElementById("notion");
    this.panel = document.getElementById("notion-panel");
    if (!this.section || !this.panel || location.protocol === "file:") return;

    /* 拿不到狀態＝沒有轉接程式（例如雙擊開啟），維持隱藏 */
    let status;
    try {
      status = await this.request("GET", "status");
    } catch {
      return;
    }
    this.status = status;
    Trip.addItem?.refresh();
    if (!status.configured) return;
    this.section.hidden = false;

    this.panel.addEventListener("click", (e) => {
      const button = e.target.closest("[data-action]");
      if (button) this[button.dataset.action]?.(button);
    });

    this.notice = this.takeLoginResult();
    await this.refresh();
  },

  /* 從 Notion 授權頁回來時，網址會帶 ?notion=結果，顯示後清掉 */
  takeLoginResult() {
    const params = new URLSearchParams(location.search);
    const result = params.get("notion");
    if (!result) return null;
    params.delete("notion");
    const query = params.toString();
    history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
    this.section.scrollIntoView();

    const messages = {
      connected: ["已連結 Notion", "ok"],
      cancelled: ["已取消 Notion 登入", "pending"],
      error: ["Notion 登入失敗，請再試一次", "error"],
      "not-configured": ["網站尚未設定 Notion 登入", "error"],
    };
    return messages[result] || null;
  },

  async request(method, path, body) {
    const res = await fetch(`/api/${path}`, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(json.error || `連線錯誤（${res.status}）`);
      err.status = res.status;
      throw err;
    }
    return json;
  },

  /* ---------- 上層頁面（放國家頁面的那一頁） ---------- */

  savedParent() {
    try {
      return JSON.parse(localStorage.getItem(this.PARENT_KEY));
    } catch {
      return null;
    }
  },

  setParent(parent) {
    this.parent = parent;
    try {
      if (parent) localStorage.setItem(this.PARENT_KEY, JSON.stringify(parent));
      else localStorage.removeItem(this.PARENT_KEY);
    } catch {
      /* 存不了就只在這次瀏覽有效 */
    }
  },

  /* 依登入狀態重新整理面板內容 */
  async refresh() {
    if (!this.status.loggedIn) {
      this.renderLoggedOut();
      return;
    }

    this.renderBusy("讀取你分享的 Notion 頁面…");
    try {
      this.pages = await this.request("GET", "notion/pages");
      const saved = this.savedParent();
      const templateId = (this.status.templatePage || "").replace(/-/g, "");
      const parent =
        (saved && this.pages.find((p) => p.id === saved.id)) ||
        (templateId && this.pages.find((p) => p.id === templateId)) ||
        (this.pages.length === 1 ? this.pages[0] : null);

      if (!parent) {
        this.setParent(null);
        this.renderChooseParent();
        return;
      }
      this.setParent({ id: parent.id, title: parent.title, url: parent.url });
      this.scan = await this.request("POST", "notion/countries", { parent: parent.id });
      this.renderReady();
      Trip.newTrip?.refresh();
    } catch (err) {
      if (err.status === 401) {
        this.status = { ...this.status, loggedIn: false };
        this.renderLoggedOut();
        Trip.addItem?.refresh();
      }
      this.message(err.message, "error");
    }
  },

  /* ---------- 動作 ---------- */

  choose(button) {
    const page = this.pages.find((p) => p.id === button.dataset.id);
    if (!page) return;
    this.setParent({ id: page.id, title: page.title, url: page.url });
    this.refresh();
  },

  changeParent() {
    this.setParent(null);
    this.renderChooseParent();
  },

  /* report：進度與結果要顯示在哪裡（預設是面板；新增行程對話框會傳自己的） */
  async sync(report = (...args) => this.message(...args)) {
    this.setBusy(true);
    try {
      const { countries } = this.scan;
      const destinations = [];
      const warnings = [];

      for (const [i, country] of countries.entries()) {
        report(`同步中（${i + 1} / ${countries.length}）：${country.title}`, "pending");
        const result = await this.request("POST", "notion/country", { page: country, config: Trip.notionCache.config() });
        warnings.push(...result.warnings);
        if (result.destination) destinations.push(result.destination);
      }
      if (this.scan.legacyTables) {
        warnings.push(`「${this.parent.title}」頁面上還有 ${this.scan.legacyTables} 張舊版表單，已不再使用，可以在 Notion 刪除`);
      }

      if (!destinations.length) {
        this.setBusy(false);
        report("沒有完整的國家行程可以顯示，網頁維持原本的內容", "error", warnings);
        return;
      }

      /* 依旅程設定的排序排列；代號重複時加上序號 */
      destinations.sort((a, b) => a.order - b.order);
      const used = new Set();
      destinations.forEach((d, i) => {
        delete d.order;
        if (used.has(d.id)) d.id = `${d.id}-${i + 1}`;
        used.add(d.id);
      });

      const saved = Trip.notionCache.save({ destinations, syncedAt: new Date().toISOString(), parent: this.parent.title });
      if (!saved) {
        this.setBusy(false);
        report("這個瀏覽器不允許儲存資料（例如無痕模式），無法保留同步結果", "error");
        return;
      }

      const done = `同步完成：${destinations.map((d) => d.name).join("、")}`;
      if (!warnings.length) {
        report(`${done}，重新載入中…`, "ok");
        setTimeout(() => location.reload(), 900);
        return;
      }
      this.setBusy(false);
      report(done, "ok", warnings, true);
    } catch (err) {
      this.setBusy(false);
      report(err.message, "error");
    }
  },

  /* 在 Notion 建立一趟行程：先建國家頁面與 5 張空表，再分批寫入各表 */
  async createTrip(dest, order, report = (...args) => this.message(...args)) {
    const config = Trip.notionCache.config();
    report(`建立「${dest.name}」頁面…`, "pending");
    const { tables } = await this.request("POST", "notion/create-country", { parent: this.parent.id, dest, config });

    for (const kind of this.KINDS) {
      let next = 0;
      let total = null;
      while (total === null || next < total) {
        report(`建立「${dest.name}」：${this.KIND_NAMES[kind]}${total ? ` ${next} / ${total}` : "…"}`, "pending");
        ({ next, total } = await this.request("POST", "notion/seed", { tables, kind, offset: next, dest, config, order }));
      }
    }
    this.scan = await this.request("POST", "notion/countries", { parent: this.parent.id });
  },

  /* 建立範例：韓國、日本（已經有的國家會略過） */
  async setup() {
    this.setBusy(true);
    try {
      const samples = [...Trip.samples].sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
      const existing = new Set(this.scan.countries.map((c) => c.title));
      for (const [i, dest] of samples.entries()) {
        if (!existing.has(dest.name)) await this.createTrip(dest, i + 1);
      }
      await this.sync();
    } catch (err) {
      this.setBusy(false);
      this.message(`${err.message}（已建立的內容會保留在 Notion，可以重新整理後再試）`, "error");
    }
  },

  reset() {
    Trip.notionCache.clear();
    location.reload();
  },

  async logout() {
    this.setBusy(true);
    try {
      await this.request("POST", "auth/logout", {});
    } catch {
      /* 就算伺服器沒回應，也清掉這台裝置上的資料 */
    }
    Trip.notionCache.clear();
    this.setParent(null);
    location.reload();
  },

  reload() {
    location.reload();
  },

  /* ---------- 畫面 ---------- */

  usingNotion() {
    return Boolean(Trip.dataSource?.syncedAt);
  },

  renderLoggedOut() {
    this.panel.innerHTML = `
<p>用你自己的 Notion 帳號登入，網頁會顯示你 Notion 裡的旅行。</p>
<p class="field__hint">登入時請選擇分享一個頁面（例如「Travel」），國家行程會放在它底下。授權只存在你這台裝置，網站不會保存。</p>
<div class="btn-row">
  <a class="btn btn--notion" href="/api/auth/login">用 Notion 登入</a>
  ${this.usingNotion() ? `<button class="btn btn--ghost" type="button" data-action="reset">改用內建範例</button>` : ""}
</div>
<p class="notion__msg" role="status" aria-live="polite"></p>`;
    this.showNotice();
  },

  renderBusy(text) {
    this.panel.innerHTML = `<p class="notion__msg is-pending" role="status" aria-live="polite">${Trip.utils.esc(text)}</p>`;
  },

  renderChooseParent() {
    const { esc } = Trip.utils;
    const pages = this.pages || [];
    this.panel.innerHTML = `
${this.statusLine()}
<div class="notion__countries">
  <p class="field__label">選擇放國家頁面的頁面</p>
  ${pages.length
    ? `<div class="btn-row">${pages.map((p) => `<button class="btn btn--ghost" type="button" data-action="choose" data-id="${esc(p.id)}">${esc(p.title)}</button>`).join("")}</div>`
    : `<p class="field__hint">你還沒有分享任何頁面給「我的旅行」。請先在 Notion 建立一個頁面（例如「Travel」），再按「重新登入」並選擇它。</p>`}
</div>
<div class="btn-row">
  <a class="btn btn--ghost" href="/api/auth/login">重新登入（換分享的頁面）</a>
  <button class="btn btn--ghost" type="button" data-action="logout">登出</button>
</div>
<p class="notion__msg" role="status" aria-live="polite"></p>`;
    this.showNotice();
  },

  renderReady() {
    const { esc } = Trip.utils;
    const countries = this.scan.countries;
    this.panel.innerHTML = `
${this.statusLine()}
<div class="notion__countries">
  <p class="field__label">國家頁面</p>
  ${countries.length
    ? `<div class="legend">${countries.map((c) => `<span class="pill tone-sky">${esc(c.title)}</span>`).join("")}</div>
       <p class="field__hint">新增國家：在 Notion 複製一個國家頁面並改成國家名稱，再按「從 Notion 同步」</p>`
    : `<p class="field__hint">「${esc(this.parent.title)}」底下還沒有國家頁面，可以先建立韓國、日本兩個範例（約 1 分鐘）</p>`}
  ${this.scan.legacyTables ? `<p class="field__hint">⚠ 這個頁面上還有 ${esc(this.scan.legacyTables)} 張舊版表單，已不再使用，可以在 Notion 刪除</p>` : ""}
</div>
<div class="btn-row">
  ${countries.length
    ? `<button class="btn" type="button" data-action="sync">從 Notion 同步</button>`
    : `<button class="btn" type="button" data-action="setup">建立範例國家頁面</button>`}
  ${(this.pages || []).length > 1 ? `<button class="btn btn--ghost" type="button" data-action="changeParent">換頁面</button>` : ""}
  ${this.usingNotion() ? `<button class="btn btn--ghost" type="button" data-action="reset">改用內建範例</button>` : ""}
  <button class="btn btn--ghost" type="button" data-action="logout">登出</button>
</div>
<p class="notion__msg" role="status" aria-live="polite"></p>`;
    this.showNotice();
  },

  statusLine() {
    const { esc } = Trip.utils;
    const where = this.parent
      ? `：<a href="${esc(this.parent.url || "https://www.notion.so")}" target="_blank" rel="noopener">${esc(this.parent.title)}</a>`
      : "";
    return `
<div class="notion__status">
  <span class="notion__dot" aria-hidden="true"></span>
  <div>
    <p>已連結 Notion${where}</p>
    <p class="field__hint">${esc(this.status.workspace || "Notion 工作區")} · 網頁目前顯示${this.usingNotion() ? "你同步的行程" : "內建範例"}</p>
  </div>
</div>`;
  },

  showNotice() {
    if (!this.notice) return;
    this.message(...this.notice);
    this.notice = null;
  },

  setBusy(busy) {
    this.panel.querySelectorAll("button, a.btn").forEach((el) => {
      if (el.tagName === "BUTTON") el.disabled = busy;
      else el.classList.toggle("is-disabled", busy);
    });
  },

  message(text, type, details = [], withReload = false) {
    this.renderMessage(this.panel.querySelector(".notion__msg"), text, type, details, withReload);
  },

  /* 訊息框共用：面板與對話框都用這個格式 */
  renderMessage(box, text, type, details = [], withReload = false) {
    const { esc } = Trip.utils;
    if (!box) return;
    box.className = text ? `notion__msg is-${type}` : "notion__msg";
    box.innerHTML = text
      ? `
${esc(text).replace(/\n/g, "<br>")}
${details.length ? `<ul class="notion__warnings">${details.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
${withReload ? `<button class="btn" type="button" data-action="reload">重新載入網頁</button>` : ""}`
      : "";
  },
};
