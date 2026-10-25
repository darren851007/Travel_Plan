/* ============================================================
   進入點：頁面載入後依序啟動各模組
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  /* 標題等文字從資料檔帶入 */
  document.title = Trip.data.title;
  document.querySelectorAll("[data-text]").forEach((el) => {
    el.textContent = Trip.data[el.dataset.text] ?? el.textContent;
  });

  Trip.art.mount();
  Trip.nav.init();
  Trip.countdown.init();
  Trip.flights.init();
  Trip.itinerary.init();
  Trip.checklist.init();
  Trip.lodging.init();
});
