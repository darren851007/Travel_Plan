/* ============================================================
   和網站伺服器（Cloudflare Worker）溝通
   - status：網站開了哪些功能（共同編輯、航班查詢、Notion 匯出）、是否已用 Notion 登入、登入的 Google 帳號（user）
   - login／logout：Google 登入（共編行程的擁有者與受邀成員都要登入）
   - request：呼叫 /api/…，失敗時丟出帶中文訊息的錯誤
   只有部署在 Cloudflare 時才有伺服器；GitHub Pages 或直接開檔案時 status 為空，相關功能會隱藏
   ============================================================ */
window.Trip = window.Trip || {};

Trip.api = {
  status: {},
  listeners: [],

  /* 狀態載入後通知（例如顯示共編、匯出按鈕） */
  onStatus(fn) {
    this.listeners.push(fn);
  },

  /* ready：狀態讀完（或確定沒有伺服器）後完成；要知道有沒有登入的地方先 await 它 */
  ready: Promise.resolve(),

  init() {
    this.ready = this.load();
    return this.ready;
  },

  async load() {
    if (location.protocol === "file:") return;
    try {
      this.status = await this.request("GET", "status");
    } catch {
      /* 沒有伺服器：維持空狀態 */
      return;
    }
    this.listeners.forEach((fn) => fn(this.status));
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

  /* 登入的 Google 帳號；沒登入是 null */
  user() {
    return this.status.user || null;
  },

  /* 轉到 Google 登入，登入完回到 back 指的畫面（預設是現在這個畫面） */
  login(back = location.hash) {
    location.href = `/api/auth/google/login?back=${encodeURIComponent(back || "")}`;
  },

  async logout() {
    await this.request("POST", "auth/google/logout", {});
    location.reload();
  },

  /* 訊息框共用：各個對話框都用這個格式 */
  renderMessage(box, text, type = "pending") {
    if (!box) return;
    box.className = text ? `notion__msg is-${type}` : "notion__msg";
    box.textContent = text || "";
  },
};
