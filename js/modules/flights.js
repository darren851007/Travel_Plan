/* ============================================================
   航班卡片
   ============================================================ */
window.Trip = window.Trip || {};

Trip.flights = {
  init() {
    const list = document.getElementById("flight-list");
    if (!list) return;

    const { esc, formatDate } = Trip.utils;

    list.innerHTML = Trip.data.flights
      .map((f, i) => {
        const day = formatDate(f.date);
        return `
<article class="card flight">
  <header class="flight__head">
    <span class="pill ${i === 0 ? "tone-peach" : "tone-sky"}">${esc(f.type)}</span>
    <h3 class="flight__no">${esc(f.airline)} ${esc(f.number)}</h3>
    <span class="flight__icon">${Trip.art.get("planeIcon")}</span>
  </header>

  <div class="flight__route">
    <div class="flight__point">
      <span class="flight__code">${esc(f.from.code)}</span>
      <span class="flight__time">${esc(f.from.time)}</span>
      <span class="flight__city">${esc(f.from.city)}</span>
    </div>
    <div class="flight__path">
      <span class="flight__plane anim-float">${Trip.art.get("planeSide")}</span>
      <span class="flight__dur">${esc(f.duration)}</span>
    </div>
    <div class="flight__point flight__point--end">
      <span class="flight__code">${esc(f.to.code)}</span>
      <span class="flight__time">${esc(f.to.time)}</span>
      <span class="flight__city">${esc(f.to.city)}</span>
    </div>
  </div>

  <dl class="flight__meta">
    <div><dt>日期</dt><dd>${day.md}（${day.weekday}）</dd></div>
    <div><dt>出發航廈</dt><dd>${esc(f.from.terminal)}</dd></div>
    <div><dt>座位</dt><dd>${esc(f.seat)}</dd></div>
    <div><dt>行李</dt><dd>${esc(f.baggage)}</dd></div>
  </dl>
</article>`;
      })
      .join("");
  },
};
