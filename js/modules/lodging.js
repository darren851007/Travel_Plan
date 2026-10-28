/* ============================================================
   住宿資訊：每個城市一間，入住／退房日依行程自動計算
   可以編輯的行程：「＋ 新增住宿」、每間住宿的「編輯」（存檔走 js/core/editor.js）
   ============================================================ */
window.Trip = window.Trip || {};

Trip.lodging = {
  init() {
    this.root = document.getElementById("lodging");
    this.addBar = document.getElementById("lodging-add-bar");
    document.getElementById("lodging-add")?.addEventListener("click", () => this.openEdit());
    this.root?.addEventListener("click", (e) => {
      const button = e.target.closest("[data-edit-lodging]");
      if (button) this.openEdit(button.dataset.editLodging);
    });
  },

  editable() {
    const dest = Trip.state.destination;
    return Trip.editor.canEdit(dest);
  },

  /* 新增（沒有 uid）或編輯一間住宿 */
  openEdit(uid) {
    const dest = Trip.state.destination;
    const lodging = uid ? (dest.lodgings || []).find((l) => l.uid === uid) : null;
    const cities = Trip.state.trip.cities;
    const run = (op, values, mutate) =>
      Trip.editor.run(dest, { table: "lodging", op, uid, values, mutate });

    Trip.editDialog.open({
      title: lodging ? "編輯住宿" : "新增住宿",
      submitLabel: lodging ? "儲存" : "新增",
      fields: [
        { name: "name", label: "住宿名稱", required: true, placeholder: "例如：弘大旅店" },
        { name: "city", label: "城市", options: cities, placeholder: cities[0] || "", hint: "入住／退房日依行程裡這個城市的日子計算" },
        { name: "address", label: "地址", max: 500 },
        { name: "room", label: "房型", placeholder: "例如：雙人房 · 含早餐" },
        { name: "checkInTime", label: "入住時間", type: "time", half: true },
        { name: "checkOutTime", label: "退房時間", type: "time", half: true },
        { name: "bookingNo", label: "訂房編號", half: true },
        { name: "phone", label: "電話", type: "tel", half: true },
        { name: "mapQuery", label: "地圖搜尋", placeholder: "Google Maps 的搜尋字，空白時用住宿名稱" },
      ],
      values: lodging || { city: cities[0] || "", checkInTime: "15:00", checkOutTime: "11:00" },
      onSubmit: async (values) => {
        await run(lodging ? "update" : "create", values, (d, id, row) => Trip.mutate.setLodging(d, id, row));
        Trip.editor.rerender();
        Trip.addItem.toast(lodging ? `已更新「${values.name}」` : `已新增「${values.name}」`);
      },
      onDelete: lodging
        ? async () => {
            await run("delete", null, (d, id) => Trip.mutate.removeLodging(d, id));
            Trip.editor.rerender();
            Trip.addItem.toast(`已刪除「${lodging.name}」`);
          }
        : null,
    });
  },

  render(trip) {
    const { root } = this;
    if (!root) return;
    if (this.addBar) this.addBar.hidden = !this.editable();

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

  <div class="lodging__actions">
    <a class="lodging__map" href="${esc(mapUrl)}" target="_blank" rel="noopener">在地圖上查看 →</a>
    ${this.editable() && l.uid ? `<button class="btn-edit" type="button" data-edit-lodging="${esc(l.uid)}">編輯</button>` : ""}
  </div>
</div>`;
  },
};
