/* ============================================================
   Google 帳號：上方選單的「登入／登出」、請對方登入的對話框
   共編行程的擁有者與受邀成員都要用 Google 登入（js/core/api.js 的 login／logout）
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
    this.dialog = $("login-dialog");
    this.text = $("login-text");
    if (!this.box || !this.dialog) return;

    this.button.addEventListener("click", () => {
      if (Trip.api.user()) this.confirmLogout();
      else Trip.api.login();
    });
    $("login-go").addEventListener("click", () => Trip.api.login());
    $("login-cancel").addEventListener("click", () => this.dialog.close());
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
    this.button.textContent = user ? `👤 ${user.name || user.email}` : "用 Google 登入";
    this.button.title = user ? `${user.email}（按一下登出）` : "";
  },

  /* 按一次顯示「登出？」，再按一次才登出 */
  confirmLogout() {
    if (!this.button.classList.contains("is-confirming")) {
      this.button.classList.add("is-confirming");
      this.button.textContent = "登出？";
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.button.classList.remove("is-confirming");
        this.render();
      }, 3000);
      return;
    }
    Trip.api.logout().catch((err) => Trip.addItem.toast(err.message));
  },

  /* 需要登入才能繼續時：說明原因，按「用 Google 登入」登入完回到現在的畫面 */
  ask(text) {
    if (!this.dialog) return;
    this.text.textContent = text;
    this.dialog.showModal();
  },
};
