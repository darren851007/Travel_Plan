/* ============================================================
   住宿資訊：每個城市一間，入住／退房日依行程自動計算
   ============================================================ */
window.Trip = window.Trip || {};

Trip.lodging = {
  init() {
    this.root = document.getElementById("lodging");
  },

  render(trip) {
    const { root } = this;
    if (!root) return;

    if (!trip.lodgings.length) {
      root.innerHTML = '<p class="section-sub">還沒有住宿資料</p>';
      return;
    }
    root.innerHTML = trip.lodgings.map((l) => this.renderOne(l)).join("");
  },

  renderOne(l) {
    const { esc, formatDate } = Trip.utils;
    const inDay = formatDate(l.checkIn.date);
    const outDay = formatDate(l.checkOut.date);
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.mapQuery || l.name)}`;
    const phone = l.phone || "";

    return `
<div class="lodging">
  <p class="lodging__name">
    ${esc(l.name)}
    ${l.city ? `<span class="pill tone-sky">${esc(l.city)}</span>` : ""}
  </p>
  <p class="section-sub">${l.room ? `${esc(l.room)} · ` : ""}${esc(l.nights)} 晚</p>

  <dl class="lodging__dates">
    <div class="lodging__date">
      <dt>入住 Check-in</dt>
      <dd>${inDay.md}（${inDay.weekday}）${esc(l.checkIn.time)}</dd>
    </div>
    <div class="lodging__date">
      <dt>退房 Check-out</dt>
      <dd>${outDay.md}（${outDay.weekday}）${esc(l.checkOut.time)}</dd>
    </div>
  </dl>

  <dl class="lodging__info">
    ${l.address ? `<div><dt>地址</dt><dd>${esc(l.address)}</dd></div>` : ""}
    ${l.bookingNo ? `<div><dt>訂房編號</dt><dd>${esc(l.bookingNo)}</dd></div>` : ""}
    ${phone ? `<div><dt>電話</dt><dd><a href="tel:${esc(phone.replace(/[^\d+]/g, ""))}">${esc(phone)}</a></dd></div>` : ""}
  </dl>

  <a class="lodging__map" href="${esc(mapUrl)}" target="_blank" rel="noopener">在地圖上查看 →</a>
</div>`;
  },
};
