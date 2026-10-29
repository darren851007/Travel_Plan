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
    Trip.addFlight,
    Trip.sharePanel,
  ];

  Trip.art.mount();
  Trip.nav.init();
  views.forEach((view) => view.init());
  Trip.state.subscribe((trip, options) => {
    views.forEach((view) => view.render(trip, options));
  });

  Trip.editDialog.init();
  Trip.newTrip.init();
  Trip.picker.init();
  Trip.picker.render();
  /* 匯出至 Notion 要在路由前處理「從 Notion 登入回來」的網址 */
  Trip.notionExport.init();
  Trip.account.init();

  /* 知道網站開了哪些功能後（共編、航班查詢、Notion 匯出、Google 登入）重畫行程，按鈕才會出現
     先開始讀狀態再啟動路由：專屬邀請連結要等知道有沒有登入 */
  Trip.api.onStatus(() => {
    if (Trip.state.destination && document.body.dataset.view === "trip") Trip.editor.rerender();
  });
  Trip.api.init();
  Trip.router.init();
});
