/* ============================================================
   第一個畫面：選擇行程（每個國家一張卡片）
   ============================================================ */
window.Trip = window.Trip || {};

Trip.picker = {
  init() {
    this.list = document.getElementById("trip-list");
    this.count = document.getElementById("trip-count");

    /* 卡片上的刪除按鈕：按兩次才刪除（js/modules/trip-delete.js） */
    this.list?.addEventListener("click", (e) => {
      const button = e.target.closest(".trip-card__delete");
      if (!button) return;
      const dest = Trip.destinations.find((d) => d.id === button.dataset.id);
      if (dest && Trip.tripDelete.confirm(button, Trip.tripDelete.label(dest))) Trip.tripDelete.remove(dest, button);
    });
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
<article class="card trip-card" style="--i:${i}">
  <div class="trip-card__art">${Trip.art.get(t.art)}</div>
  <div class="trip-card__body">
    <p class="trip-card__country">
      <span aria-hidden="true">${esc(t.flag)}</span>${esc(t.name)}
      ${t.local ? '<span class="pill tone-butter">這台裝置</span>' : ""}
      <span class="pill tone-mint">${esc(t.dateRange)}</span>
    </p>
    <h2 class="trip-card__title"><a class="trip-card__link" href="#/${encodeURIComponent(t.id)}">${esc(t.title)}</a></h2>
    <p class="trip-card__meta">${esc(t.cities.join(" → "))} · ${t.days.length} 天 ${t.nights} 夜</p>
    <div class="trip-card__foot">
      <span>${this.countdownText(t.departure)}</span>
      <span class="trip-card__actions">
        <button class="btn btn--ghost btn--small trip-card__delete" type="button" data-id="${esc(t.id)}" aria-label="刪除「${esc(t.title)}」" hidden>刪除</button>
        <span class="trip-card__go" aria-hidden="true">查看行程 →</span>
      </span>
    </div>
  </div>
</article>`
      )
      .join("") + this.newTripCard(trips.length);
    Trip.newTrip?.refresh();
    this.updateActions();
  },

  /* 只有能刪除的行程顯示刪除鈕（Notion 登入狀態是之後才知道的，面板也會呼叫） */
  updateActions() {
    this.list?.querySelectorAll(".trip-card__delete").forEach((button) => {
      const dest = Trip.destinations.find((d) => d.id === button.dataset.id);
      button.hidden = !Trip.tripDelete.canDelete(dest);
      button.disabled = false;
      Trip.tripDelete.reset(button, Trip.tripDelete.label(dest));
    });
  },

  /* 「＋ 新增行程」卡片（js/modules/new-trip.js 依狀態更新文字） */
  newTripCard(index) {
    return `
<button class="card trip-card trip-card--new" type="button" id="new-trip-open" style="--i:${index}" hidden>
  <span class="trip-card__plus" aria-hidden="true">＋</span>
  <span class="trip-card__title">新增行程</span>
  <span class="trip-card__meta">選國家、城市與天數</span>
</button>`;
  },

  countdownText(departure) {
    const days = Math.ceil((new Date(departure).getTime() - Date.now()) / 86400000);
    if (days > 0) return `還有 ${days} 天出發`;
    return days === 0 ? "今天出發！" : "已出發";
  },
};
