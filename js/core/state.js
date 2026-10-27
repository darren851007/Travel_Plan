/* ============================================================
   目前選擇的行程 — 變更時通知所有訂閱的模組重繪
   要顯示哪趟行程由網址決定（js/core/router.js）
   ============================================================ */
window.Trip = window.Trip || {};

Trip.state = {
  listeners: [],
  destination: null,
  trip: null,

  subscribe(fn) {
    this.listeners.push(fn);
  },

  /* 選擇行程；找不到這個代號時回傳 false */
  select(id, animate) {
    const dest = Trip.destinations.find((d) => d.id === id);
    if (!dest) return false;

    this.destination = dest;
    this.trip = Trip.builder.build(dest);
    this.listeners.forEach((fn) => fn(this.trip, { animate }));
    return true;
  },
};
