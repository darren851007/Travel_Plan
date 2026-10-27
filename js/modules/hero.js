/* ============================================================
   首頁：依目前地點更新插圖、標題、日期與選單名稱
   ============================================================ */
window.Trip = window.Trip || {};

Trip.hero = {
  init() {
    this.art = document.getElementById("hero-art");
    this.texts = [...document.querySelectorAll("[data-text]")];
  },

  render(trip, { animate }) {
    document.title = trip.title;
    this.texts.forEach((el) => {
      el.textContent = trip[el.dataset.text] ?? "";
    });

    if (!this.art || this.currentArt === trip.art) return;
    this.currentArt = trip.art;
    this.art.innerHTML = Trip.art.get(trip.art);
    if (animate) Trip.utils.replay(this.art);
  },
};
