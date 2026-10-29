/* ============================================================
   Google 帳號：上方選單的「登入／登出」
   第一次打開專屬邀請連結的對話框：用 Google 登入，或輸入名字以訪客繼續（js/core/api.js 的 login／logout）
   擁有者要用 Google 登入；受邀的人可以登入，也可以只輸入名字
   從 Google 登入回來時網址會帶 ?login=結果，顯示提示後拿掉
   ============================================================ */
window.Trip = window.Trip || {};

Trip.account = {
  RESULTS: {
    ok: "已用 Google 登入",
    cancelled: "已取消 Google 登入",
    error: "Google 登入失敗，請再試一次",
    "not-configured": "網站尚未設定 Google 登入",
  },

  init() {
    const $ = (id) => document.getElementById(id);
    this.box = $("account");
    this.button = $("account-button");
    this.dialog = $("join-dialog");
    this.google = $("join-google");
    this.name = $("join-name");
    this.msg = $("join-msg");
    if (!this.box || !this.dialog) return;

    this.button.addEventListener("click", () => {
      if (Trip.api.user()) this.confirmLogout();
      else Trip.api.login();
    });
    this.google.addEventListener("click", () => this.joinWithGoogle());
    $("join-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.joinAsGuest();
    });
    $("join-cancel").addEventListener("click", () => this.dialog.close());
    $("presence-login")?.addEventListener("click", () => Trip.api.login());
    this.dialog.addEventListener("click", (e) => {
      if (e.target === this.dialog) this.dialog.close();
    });

    const params = new URLSearchParams(location.search);
    const result = params.get("login");
    if (result) {
      params.delete("login");
      const query = params.toString();
      history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
      setTimeout(() => Trip.addItem.toast(this.RESULTS[result] || this.RESULTS.error), 300);
    }

    Trip.api.onStatus(() => this.render());
  },

  render() {
    const status = Trip.api.status;
    this.box.hidden = !status.google;
    const user = Trip.api.user();
    /* 手機的行程頁空間不夠，只留 👤（名字藏在 .account__name，CSS 決定要不要顯示） */
    const { esc } = Trip.utils;
    this.button.innerHTML = user
      ? `<span aria-hidden="true">👤</span><span class="account__name">${esc(user.name || user.email)}</span>`
      : `<span aria-hidden="true">👤</span><span class="account__name">用 Google 登入</span>`;
    this.button.setAttribute("aria-label", user ? `${user.name || user.email}，按一下登出` : "用 Google 登入");
    this.button.title = user ? `${user.email}（按一下登出）` : "用 Google 登入";
  },

  /* 按一次顯示「登出？」，再按一次才登出 */
  confirmLogout() {
    if (!this.button.classList.contains("is-confirming")) {
      this.button.classList.add("is-confirming");
      this.button.innerHTML = `<span aria-hidden="true">👤</span><span class="account__name">登出？</span>`;
      this.button.setAttribute("aria-label", "再按一次登出");
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.button.classList.remove("is-confirming");
        this.render();
      }, 3000);
      return;
    }
    Trip.api.logout().catch((err) => Trip.addItem.toast(err.message));
  },

  /* ---------- 「用 Google 登入，或輸入名字繼續」對話框 ----------
     打開專屬邀請連結（加入共編）、在好友分享的行程按「加入我的行程」（送出申請）都用這個
     ask({ title, text, submit, googleKey })：
     - submit(options) 真正去做；options.guestName 有值就是以訪客身分
     - googleKey：沒登入時按 Google 登入，登入完回到這個畫面就直接做（不再問一次） */

  GOOGLE_KEY: "trip-join-google",

  ask({ title, text, submit, googleKey }) {
    if (!this.dialog) return;
    this.task = { submit, googleKey };
    const user = Trip.api.user();
    const status = Trip.api.status;
    document.getElementById("join-title").textContent = title;
    document.getElementById("join-text").textContent = text;
    this.google.hidden = !status.google;
    this.google.textContent = user ? `以 Google 帳號（${user.name || user.email}）繼續` : "用 Google 登入";
    this.name.value = status.guest?.name || Trip.collab.myName() || "";
    this.message("");
    this.setBusy(false);
    this.dialog.showModal();
  },

  askJoin(roomId, code) {
    this.ask({
      title: "加入共編行程",
      text: "你收到一趟共編行程的邀請。這條連結只能給一個人使用，第一次加入後就會綁定。",
      googleKey: `join:${roomId}/${code}`,
      submit: async (options) => {
        const dest = await Trip.collab.accept(roomId, code, options);
        Trip.picker.render();
        location.hash = `#/${encodeURIComponent(dest.id)}`;
        Trip.addItem.toast("已加入共編行程");
      },
    });
  },

  /* 已經登入就直接做；沒登入就先登入，回來後直接做 */
  joinWithGoogle() {
    if (Trip.api.user()) {
      this.run({});
      return;
    }
    try {
      sessionStorage.setItem(this.GOOGLE_KEY, this.task.googleKey);
    } catch {
      /* 記不住就回來再按一次 */
    }
    Trip.api.login();
  },

  /* 從 Google 登入回來時：是剛才在對話框按的登入（同一個 googleKey）就回傳 true */
  takeGoogle(key) {
    try {
      const pending = sessionStorage.getItem(this.GOOGLE_KEY);
      if (pending !== key) return false;
      sessionStorage.removeItem(this.GOOGLE_KEY);
      return Boolean(Trip.api.user());
    } catch {
      return false;
    }
  },

  joinAsGuest() {
    const name = this.name.value.trim();
    if (!name) {
      this.message("請輸入名字", "error");
      this.name.focus();
      return;
    }
    Trip.collab.setName(name);
    this.run({ guestName: name });
  },

  async run(options) {
    this.setBusy(true);
    this.message("處理中…", "pending");
    try {
      await this.task.submit(options);
      this.dialog.close();
      /* 以訪客身分之後，網站的狀態裡會有訪客名字 */
      if (options.guestName) Trip.api.init();
    } catch (err) {
      this.setBusy(false);
      this.message(err.message, "error");
    }
  },

  setBusy(busy) {
    this.google.disabled = busy;
    document.getElementById("join-guest").disabled = busy;
  },

  message(text, type = "pending") {
    Trip.api.renderMessage(this.msg, text, type);
  },
};
