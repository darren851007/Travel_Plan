/* ============================================================
   行程首頁：依目前行程更新插圖、標題、日期與選單名稱
   可以刪除的行程顯示「刪除這趟行程」（邏輯在 js/modules/trip-delete.js）
   ============================================================ */
window.Trip = window.Trip || {};

Trip.hero = {
  init() {
    this.art = document.getElementById("hero-art");
    this.texts = [...document.querySelectorAll("[data-text]")];
    this.localBar = document.getElementById("trip-local");
    this.where = document.getElementById("trip-where");
    this.deleteButton = document.getElementById("trip-delete");
    this.deleteButton?.addEventListener("click", () => this.confirmDelete());
  },

  /* 刪除行程（共用 js/modules/trip-delete.js）：按兩次才刪除 */
  confirmDelete() {
    const dest = Trip.state.destination;
    if (Trip.tripDelete.confirm(this.deleteButton, this.deleteLabel(dest))) {
      Trip.tripDelete.remove(dest, this.deleteButton);
    }
  },

  deleteLabel(dest) {
    return dest?.notionPageId ? "移到 Notion 垃圾桶" : "刪除這趟行程";
  },

  /* 依行程來源顯示刪除按鈕（Notion 登入狀態是之後才知道的，所以面板也會呼叫） */
  updateActions() {
    const dest = Trip.state.destination;
    if (!this.localBar || !dest) return;
    this.localBar.hidden = !Trip.tripDelete.canDelete(dest);
    this.where.textContent = dest.local ? "存在這台裝置" : dest.notionPageId ? "存在你的 Notion" : "範例行程";
    this.deleteButton.disabled = false;
    Trip.tripDelete.reset(this.deleteButton, this.deleteLabel(dest));
  },

  render(trip, { animate }) {
    document.title = trip.title;
    this.updateActions();
    this.texts.forEach((el) => {
      el.textContent = trip[el.dataset.text] ?? "";
    });

    if (!this.art || this.currentArt === trip.art) return;
    this.currentArt = trip.art;
    this.art.innerHTML = Trip.art.get(trip.art);
    if (animate) Trip.utils.replay(this.art);
  },
};
