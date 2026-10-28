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
        /* 第一段＋轉機段 */
        const legs = [f, ...(f.connections || [])];
        const last = legs[legs.length - 1];
        return `
<article class="card flight">
  <header class="flight__head">
    <span class="pill ${i === 0 ? "tone-peach" : "tone-sky"}">${esc(f.type)}</span>
    <h3 class="flight__no">${esc(f.airline)} ${esc(f.number)}</h3>
    ${this.logo(f)}
  </header>
  ${legs.length > 1 ? `<p class="flight__stops">轉機 ${legs.length - 1} 次 · ${legs.map((l) => esc(l.from.code)).join(" → ")} → ${esc(last.to.code)}</p>` : ""}

  ${legs.map((leg, k) => `
  ${k > 0 ? `
  <div class="flight__layover">
    <span>轉機 · ${esc(leg.from.city || legs[k - 1].to.city)} ${esc(leg.from.code || legs[k - 1].to.code)}</span>
    ${Trip.addFlight.layover(legs[k - 1].to.time, leg.from.time) ? `<span>停留 ${Trip.addFlight.layover(legs[k - 1].to.time, leg.from.time)}</span>` : ""}
  </div>
  <p class="flight__leg-no">第 ${k + 1} 段 · ${esc(leg.airline)} ${esc(leg.number)}${leg.aircraft ? ` · ${esc(leg.aircraft)}` : ""}</p>` : ""}
  <div class="flight__route">
    <div class="flight__point">
      <span class="flight__code">${esc(leg.from.code)}</span>
      <span class="flight__time">${esc(leg.from.time)}</span>
      <span class="flight__city">${esc(leg.from.city)}${leg.from.terminal && k > 0 ? ` ${esc(leg.from.terminal)}` : ""}</span>
    </div>
    <div class="flight__path">
      <span class="flight__plane anim-float">${Trip.art.get("planeSide")}</span>
      <span class="flight__dur">${esc(leg.duration)}</span>
    </div>
    <div class="flight__point flight__point--end">
      <span class="flight__code">${esc(leg.to.code)}</span>
      <span class="flight__time">${esc(leg.to.time)}</span>
      <span class="flight__city">${esc(leg.to.city)}${leg.to.terminal && k < legs.length - 1 ? ` ${esc(leg.to.terminal)}` : ""}</span>
    </div>
  </div>`).join("")}

  <dl class="flight__meta">
    <div><dt>日期</dt><dd>${day.md}（${day.weekday}）</dd></div>
    ${f.aircraft ? `<div><dt>機型</dt><dd>${esc(f.aircraft)}</dd></div>` : ""}
    <div><dt>出發航廈</dt><dd>${esc(f.from.terminal)}</dd></div>
    ${last.to.terminal ? `<div><dt>抵達航廈</dt><dd>${esc(last.to.terminal)}</dd></div>` : ""}
    ${passengers.length ? "" : `<div><dt>座位</dt><dd>${esc(f.seat)}</dd></div>`}
    <div><dt>行李</dt><dd>${esc(f.baggage)}</dd></div>
  </dl>
  ${passengers.length ? `
  <ul class="flight__passengers" aria-label="旅客與座位">
    ${passengers
      .map((p, k) => {
        const body = `<span>${esc(p.name || "旅客")}</span><span class="seat">${esc(p.seat || "未選位")}</span>`;
        /* 可以編輯時，點旅客直接打開編輯、跳到這位旅客 */
        return editable
          ? `<li><button class="passenger-chip" type="button" data-edit-flight="${esc(f.type)}" data-passenger="${k}" aria-label="編輯旅客 ${esc(p.name || "旅客")}">${body}</button></li>`
          : `<li>${body}</li>`;
      })
      .join("")}
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
