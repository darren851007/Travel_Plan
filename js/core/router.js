/* ============================================================
   畫面切換：#/ ＝ 選擇行程，#/my-xxxx ＝ 某趟行程，#/share/… ＝ 好友分享的行程（唯讀），
   #/room/… ＝ 共編行程的邀請連結（加入後網址換成 #/room-…）
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
  async apply(animate) {
    let id = this.current();

    /* 分享連結：先解開行程內容；打不開就回到選擇行程並說明原因 */
    if (id?.startsWith("share/")) {
      try {
        Trip.state.shared = await Trip.share.decode(id.slice("share/".length));
        id = "shared";
      } catch (err) {
        id = null;
        Trip.addItem?.toast(err.message || "這個分享連結打不開");
      }
    }

    /* 共編邀請：加入我的清單後換成一般的行程網址 */
    if (id?.startsWith("room/")) {
      try {
        const dest = await Trip.collab.join(id.slice("room/".length));
        id = dest.id;
        history.replaceState(null, "", `${location.pathname}${location.search}#/${encodeURIComponent(id)}`);
        Trip.picker.render();
      } catch (err) {
        id = null;
        Trip.addItem?.toast(err.message || "這個共編連結打不開");
      }
    }

    const showTrip = Boolean(id) && Trip.state.select(id, animate);
    Trip.collab?.follow(showTrip ? Trip.state.destination?.room || null : null);
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
