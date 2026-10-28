/* ============================================================
   航班卡片
   ============================================================ */
window.Trip = window.Trip || {};

Trip.flights = {
  init() {
    this.list = document.getElementById("flight-list");
  },

  render(trip, { animate }) {
    const { list } = this;
    if (!list) return;

    const { esc, formatDate } = Trip.utils;
    const dest = Trip.state.destination;
    const editable = Trip.editor.canEdit(dest);

    list.innerHTML = trip.flights
      .map((f, i) => {
        const day = formatDate(f.date);
        const passengers = f.passengers || [];
        return `
<article class="card flight">
  <header class="flight__head">
    <span class="pill ${i === 0 ? "tone-peach" : "tone-sky"}">${esc(f.type)}</span>
    <h3 class="flight__no">${esc(f.airline)} ${esc(f.number)}</h3>
    ${this.logo(f)}
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
    ${f.aircraft ? `<div><dt>機型</dt><dd>${esc(f.aircraft)}</dd></div>` : ""}
    <div><dt>出發航廈</dt><dd>${esc(f.from.terminal)}</dd></div>
    ${f.to.terminal ? `<div><dt>抵達航廈</dt><dd>${esc(f.to.terminal)}</dd></div>` : ""}
    ${passengers.length ? "" : `<div><dt>座位</dt><dd>${esc(f.seat)}</dd></div>`}
    <div><dt>行李</dt><dd>${esc(f.baggage)}</dd></div>
  </dl>
  ${passengers.length ? `
  <ul class="flight__passengers" aria-label="旅客與座位">
    ${passengers.map((p) => `<li><span>${esc(p.name || "旅客")}</span><span class="seat">${esc(p.seat || "未選位")}</span></li>`).join("")}
  </ul>` : ""}
  ${editable ? `<div class="flight__actions"><button class="btn-edit" type="button" data-edit-flight="${esc(f.type)}">編輯</button></div>` : ""}
</article>`;
      })
      .join("");

    /* logo 載入失敗（離線、服務異常）時換回飛機圖示 */
    list.querySelectorAll(".flight__logo img").forEach((img) => {
      img.addEventListener("error", () => {
        img.parentElement.outerHTML = `<span class="flight__icon">${Trip.art.get("planeIcon")}</span>`;
      }, { once: true });
    });

    if (animate) Trip.utils.replay(list);
  },

  /* 航空公司 logo：航班號碼開頭的代碼在 js/data/airlines.js 清單裡才顯示，否則用飛機圖示 */
  logo(f) {
    const { esc } = Trip.utils;
    const code = Trip.airlineCode(f.number);
    if (!code) return `<span class="flight__icon">${Trip.art.get("planeIcon")}</span>`;
    const name = f.airline || Trip.airlines[code];
    return `
<span class="flight__logo">
  <img src="https://pics.avs.io/240/80/${esc(code)}.png" alt="${esc(name)}" width="96" height="32" loading="lazy" referrerpolicy="no-referrer">
</span>`;
  },
};
