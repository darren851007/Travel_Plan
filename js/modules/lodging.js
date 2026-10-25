/* ============================================================
   住宿資訊卡片
   ============================================================ */
window.Trip = window.Trip || {};

Trip.lodging = {
  init() {
    const root = document.getElementById("lodging");
    if (!root) return;

    const { esc, formatDate } = Trip.utils;
    const l = Trip.data.lodging;
    const inDay = formatDate(l.checkIn.date);
    const outDay = formatDate(l.checkOut.date);
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.mapQuery)}`;

    root.innerHTML = `
<p class="lodging__name">${esc(l.name)}</p>
<p class="section-sub">${esc(l.room)} · ${esc(l.nights)} 晚</p>

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
  <div><dt>地址</dt><dd>${esc(l.address)}</dd></div>
  <div><dt>訂房編號</dt><dd>${esc(l.bookingNo)}</dd></div>
  <div><dt>電話</dt><dd><a href="tel:${esc(l.phone.replace(/[^\d+]/g, ""))}">${esc(l.phone)}</a></dd></div>
</dl>

<a class="lodging__map" href="${esc(mapUrl)}" target="_blank" rel="noopener">在地圖上查看 →</a>`;
  },
};
