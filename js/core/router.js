/* ============================================================
   畫面切換：#/ ＝ 選擇行程，#/korea ＝ 韓國行程
   用網址記錄目前畫面，可以加書籤、按上一頁返回
   ============================================================ */
window.Trip = window.Trip || {};

Trip.router = {
  init() {
    window.addEventListener("hashchange", () => this.apply(true));
    this.apply(false);
  },

  current() {
    const match = location.hash.match(/^#\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  },

  /* 依網址顯示選擇行程畫面或某趟行程 */
  apply(animate) {
    const id = this.current();
    const showTrip = Boolean(id) && Trip.state.select(id, animate);
    document.body.dataset.view = showTrip ? "trip" : "picker";

    const brand = document.querySelector(".brand");
    if (!showTrip) {
      document.title = "我的旅行";
      document.querySelector(".brand__text").textContent = "我的旅行";
      brand?.removeAttribute("aria-label");
    } else {
      brand?.setAttribute("aria-label", "回到所有行程");
    }

    if (animate) {
      window.scrollTo(0, 0);
      Trip.utils.replay(document.getElementById(showTrip ? "trip-view" : "trips"));
    }
  },
};
