/* ============================================================
   Notion 連結面板：連結帳號、建立範例國家頁面、同步資料
   只有用 npm start 開啟（本機伺服器）時才會顯示
   ============================================================ */
window.Trip = window.Trip || {};

Trip.notionPanel = {
  async init() {
    this.section = document.getElementById("notion");
    this.panel = document.getElementById("notion-panel");
    if (!this.section || !this.panel || location.protocol === "file:") return;

    /* 拿不到狀態＝不是本機伺服器（例如 GitHub Pages），維持隱藏 */
    let status;
    try {
      status = await this.request("GET", "status");
    } catch {
      return;
    }
    this.section.hidden = false;

    this.panel.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      this.run("connect", { token: form.get("token"), page: form.get("page") }, "正在確認金鑰與頁面…");
    });

    this.panel.addEventListener("click", (e) => {
      const action = e.target.closest("[data-action]")?.dataset.action;
      if (action) this[action]?.();
    });

    this.render(status);
  },

  async request(method, action, body) {
    const res = await fetch(`/api/notion/${action}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `伺服器錯誤（${res.status}）`);
    return json;
  },

  /* 執行動作：期間按鈕停用，完成後更新畫面 */
  async run(action, body, pendingText) {
    this.setBusy(true, pendingText);
    try {
      const status = await this.request("POST", action, body || {});
      this.render(status);
      return status;
    } catch (err) {
      this.setBusy(false);
      this.message(err.message, "error");
      return null;
    }
  },

  async setup() {
    const status = await this.run("setup", null, "正在 Notion 建立範例國家頁面並填入資料，大約 40 秒…");
    if (status) this.sync();
  },

  async sync() {
    this.setBusy(true, "正在從 Notion 同步…");
    try {
      const { destinations, warnings } = await this.request("POST", "sync", {});
      const done = `同步完成：${destinations.join("、")}`;
      if (!warnings.length) {
        this.message(`${done}，重新載入中…`, "ok");
        setTimeout(() => location.reload(), 900);
        return;
      }
      /* 有警告時先讓使用者看完，再自己按重新載入 */
      this.setBusy(false);
      this.message(done, "ok", warnings, true);
    } catch (err) {
      this.setBusy(false);
      this.message(err.message, "error");
    }
  },

  async reset() {
    const status = await this.run("reset", null, "改回內建範例…");
    if (status) location.reload();
  },

  disconnect() {
    this.run("disconnect", null, "中斷連結中…");
  },

  reload() {
    location.reload();
  },

  render(status) {
    const { esc } = Trip.utils;
    const usingNotion = Boolean(Trip.dataSource?.syncedAt);

    if (!status.connected) {
      this.panel.innerHTML = `
<form class="notion__form">
  <label class="field">
    <span class="field__label">整合金鑰</span>
    <input name="token" type="password" autocomplete="off" spellcheck="false" placeholder="ntn_…" required>
    <span class="field__hint">到 <a href="https://www.notion.so/profile/integrations" target="_blank" rel="noopener">Notion 整合頁面</a> 建立「內部整合」後複製</span>
  </label>
  <label class="field">
    <span class="field__label">頁面網址</span>
    <input name="page" type="url" autocomplete="off" placeholder="https://www.notion.so/…" required>
    <span class="field__hint">放所有國家頁面的上層頁面（例如「Travel」）；先在該頁面右上角「⋯ → 連線」加入你的整合</span>
  </label>
  <div class="btn-row">
    <button class="btn" type="submit">連結 Notion</button>
  </div>
</form>
<p class="notion__msg" role="status" aria-live="polite"></p>`;
      return;
    }

    const countries = status.countries || [];
    const buttons = countries.length
      ? `<button class="btn" type="button" data-action="sync">從 Notion 同步</button>`
      : `<button class="btn" type="button" data-action="setup">建立範例國家頁面</button>`;

    this.panel.innerHTML = `
<div class="notion__status${status.error ? " is-error" : ""}">
  <span class="notion__dot" aria-hidden="true"></span>
  <div>
    <p>已連結：<a href="${esc(status.pageUrl)}" target="_blank" rel="noopener">${esc(status.pageTitle || "Notion 頁面")}</a></p>
    <p class="field__hint">金鑰 ${esc(status.token)} · 網頁目前使用${usingNotion ? " Notion 資料" : "內建範例"}</p>
  </div>
</div>
<div class="notion__countries">
  <p class="field__label">國家頁面</p>
  ${countries.length
    ? `<div class="legend">${countries.map((c) => `<span class="pill tone-sky">${esc(c)}</span>`).join("")}</div>
       <p class="field__hint">新增國家：在 Notion 複製一個國家頁面並改成國家名稱，再按「從 Notion 同步」</p>`
    : `<p class="field__hint">「${esc(status.pageTitle || "這個頁面")}」底下還沒有國家頁面，可以先建立韓國、日本兩個範例</p>`}
  ${status.legacyTables ? `<p class="field__hint">⚠ 這個頁面上還有 ${esc(status.legacyTables)} 張舊版表單，已不再使用，可以在 Notion 刪除</p>` : ""}
</div>
<div class="btn-row">
  ${buttons}
  ${usingNotion ? `<button class="btn btn--ghost" type="button" data-action="reset">改用內建範例</button>` : ""}
  <button class="btn btn--ghost" type="button" data-action="disconnect">中斷連結</button>
</div>
<p class="notion__msg" role="status" aria-live="polite"></p>`;

    if (status.error) this.message(status.error, "error");
  },

  setBusy(busy, text) {
    this.panel.querySelectorAll("button, input").forEach((el) => {
      el.disabled = busy;
    });
    if (text) this.message(text, "pending");
  },

  message(text, type, details = [], withReload = false) {
    const { esc } = Trip.utils;
    const box = this.panel.querySelector(".notion__msg");
    if (!box) return;
    box.className = `notion__msg is-${type}`;
    box.innerHTML = `
${esc(text).replace(/\n/g, "<br>")}
${details.length ? `<ul class="notion__warnings">${details.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
${withReload ? `<button class="btn" type="button" data-action="reload">重新載入網頁</button>` : ""}`;
  },
};
