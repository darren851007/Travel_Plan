/* ============================================================
   第一個畫面：選擇行程（每個國家一張卡片）
   ============================================================ */
window.Trip = window.Trip || {};

Trip.picker = {
  init() {
    this.list = document.getElementById("trip-list");
    this.count = document.getElementById("trip-count");
  },

  render() {
    if (!this.list) return;
    const { esc } = Trip.utils;
    const trips = Trip.destinations.map((d) => Trip.builder.build(d));

    if (this.count) this.count.textContent = trips.length ? `共 ${trips.length} 趟旅程` : "";
    if (!trips.length) {
      this.list.innerHTML = '<p class="trips__empty">還沒有行程，到 Notion 新增一個國家頁面後同步。</p>' + this.newTripCard(0);
      Trip.newTrip?.refresh();
      return;
    }

    this.list.innerHTML = trips
      .map(
        (t, i) => `
<a class="card trip-card" href="#/${encodeURIComponent(t.id)}" style="--i:${i}">
  <div class="trip-card__art">${Trip.art.get(t.art)}</div>
  <div class="trip-card__body">
    <p class="trip-card__country">
      <span aria-hidden="true">${esc(t.flag)}</span>${esc(t.name)}
      <span class="pill tone-mint">${esc(t.dateRange)}</span>
    </p>
    <h2 class="trip-card__title">${esc(t.title)}</h2>
    <p class="trip-card__meta">${esc(t.cities.join(" → "))} · ${t.days.length} 天 ${t.nights} 夜</p>
    <p class="trip-card__foot">
      <span>${this.countdownText(t.departure)}</span>
      <span class="trip-card__go">查看行程 →</span>
    </p>
  </div>
</a>`
      )
      .join("") + this.newTripCard(trips.length);
    Trip.newTrip?.refresh();
  },

  /* 「＋ 新增行程」卡片：登入 Notion 並選好頁面後才顯示（js/modules/new-trip.js） */
  newTripCard(index) {
    return `
<button class="card trip-card trip-card--new" type="button" id="new-trip-open" style="--i:${index}" hidden>
  <span class="trip-card__plus" aria-hidden="true">＋</span>
  <span class="trip-card__title">新增行程</span>
  <span class="trip-card__meta">選國家、城市與天數，建立到你的 Notion</span>
</button>`;
  },

  countdownText(departure) {
    const days = Math.ceil((new Date(departure).getTime() - Date.now()) / 86400000);
    if (days > 0) return `還有 ${days} 天出發`;
    return days === 0 ? "今天出發！" : "已出發";
  },
};
