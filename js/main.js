/* ============================================================
   進入點：啟動各模組，依網址顯示「選擇行程」或某趟行程
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  /* 行程畫面的模組：init() 綁事件一次，render(trip) 每次切換行程時重畫 */
  const views = [
    Trip.hero,
    Trip.countdown,
    Trip.flights,
    Trip.itinerary,
    Trip.checklist,
    Trip.lodging,
    Trip.addItem,
  ];

  /* 頁尾顯示資料來源：Notion 同步或內建範例 */
  const source = document.getElementById("data-source");
  if (source) {
    const synced = Trip.dataSource?.syncedAt;
    source.textContent = synced
      ? `資料來源：你的 Notion · 同步於 ${new Date(synced).toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" })}`
      : "資料來源：內建範例資料";
  }

  Trip.art.mount();
  Trip.nav.init();
  views.forEach((view) => view.init());
  Trip.state.subscribe((trip, options) => {
    views.forEach((view) => view.render(trip, options));
  });

  Trip.newTrip.init();
  Trip.picker.init();
  Trip.picker.render();
  Trip.router.init();

  Trip.notionPanel.init();
});
