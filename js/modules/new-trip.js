/* ============================================================
   新增行程（整趟旅程）：選國家 → 城市（只選一個，可以不選）→ 出發日與回程日 → 標題
   天數由出發日與回程日決定，每天預設都是選的城市（之後在「編輯這一天」改）
   國家、城市是可搜尋的選單（js/core/combobox.js，選項來自 js/core/places.js）
   js/data/cities.json 的常用城市有專屬插圖
   先填好每天的預設行程與住宿；航班之後在行程頁按「＋ 新增航班」
   行程存在這台裝置的瀏覽器；之後可以轉成共編，或匯出到 Notion
   可以選一張封面照片（js/core/photos.js，照片存在這台裝置）
   ============================================================ */
window.Trip = window.Trip || {};

Trip.newTrip = {
  MAX_DAYS: 30,
  DEFAULT_DAYS: 3,

  init() {
    const $ = (id) => document.getElementById(id);
    this.dialog = $("new-trip-dialog");
    this.form = $("new-trip-form");
    if (!this.dialog || !this.form) return;

    this.fields = {
      country: $("new-trip-country"),
      city: $("new-trip-city"),
      date: $("new-trip-date"),
      end: $("new-trip-end"),
      endHint: $("new-trip-end-hint"),
      title: $("new-trip-name"),
      summary: $("new-trip-summary"),
      msg: $("new-trip-msg"),
      submit: $("new-trip-submit"),
      cancel: $("new-trip-cancel"),
      photo: $("new-trip-photo"),
    };
    const f = this.fields;

    /* 卡片每次重畫都是新的，所以從清單上委派點擊 */
    document.getElementById("trip-list")?.addEventListener("click", (e) => {
      if (e.target.closest("#new-trip-open")) this.open();
    });

    f.cancel.addEventListener("click", () => this.dialog.close());
    this.countryBox = Trip.combobox.create({
      input: f.country,
      list: $("new-trip-country-list"),
      load: (q) => Trip.places.countryOptions(q),
      onSelect: (item) => this.chooseCountry(item.value),
      empty: "找不到這個國家",
    });
    this.cityBox = Trip.combobox.create({
      input: f.city,
      list: $("new-trip-city-list"),
      load: (q) => Trip.places.cityOptions(this.country, q),
      onSelect: (item) => this.chooseCity(item.value),
      empty: "找不到這個城市",
    });
    /* 出發日：天數不變，回程日跟著移動；回程日：改天數 */
    f.date.addEventListener("change", () => this.renderSummary());
    f.end.addEventListener("change", () => this.applyEndDate());
    f.title.addEventListener("input", () => {
      this.titleEdited = true;
    });
    this.form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.save();
    });
    this.form.addEventListener("click", (e) => {
      if (e.target.closest('[data-action="reload"]')) location.reload();
    });
    /* 建立中不能關閉 */
    this.dialog.addEventListener("cancel", (e) => {
      if (this.saving) e.preventDefault();
    });
    this.dialog.addEventListener("click", (e) => {
      if (e.target === this.dialog && !this.saving) this.dialog.close();
    });
  },

  refresh() {
    const card = document.getElementById("new-trip-open");
    if (card) card.hidden = location.protocol === "file:";
  },

  /* ---------- 對話框 ---------- */

  async open() {
    const f = this.fields;
    this.photo = Trip.photos.field(f.photo, null);
    this.message("");
    this.setSaving(false);
    this.dialog.showModal();

    try {
      this.data = await Trip.places.ready();
    } catch (err) {
      this.message(`讀不到城市清單：${err.message}`, "error");
      return;
    }

    /* 出發日預設一個月後 */
    const today = Trip.utils.todayIso();
    f.date.min = today;
    f.date.value = Trip.utils.addDays(today, 30);
    this.titleEdited = false;
    this.days = this.DEFAULT_DAYS;
    /* 預設：常用清單的第一個國家 */
    this.chooseCountry(Trip.places.firstCountry(), { focus: false });
  },

  /* ---------- 國家與城市（可搜尋的選單，選項來自 js/core/places.js） ---------- */

  /* 換國家：城市清空（不自動放預設城市）
     使用者選的（focus）：游標移到城市欄並列出這個國家的城市 */
  chooseCountry(country, { focus = true } = {}) {
    this.country = country;
    this.countryBox.setText(`${country.flag} ${country.name}`);
    this.chooseCity(null);
    if (!this.titleEdited) this.fields.title.value = `${country.name}小旅行`;
    this.renderSummary();
    if (focus) {
      this.fields.city.focus();
      this.cityBox.search("");
    }
  },

  /* city：{ name, place }；null 是不指定城市 */
  chooseCity(city) {
    this.city = city;
    this.cityBox.setText(city?.name || "");
  },

  /* 依回程日算出天數（1 到 30 天） */
  applyEndDate() {
    const f = this.fields;
    const days = Trip.utils.daysBetween(f.date.value, f.end.value) + 1;
    if (!Number.isFinite(days)) return this.renderSummary();
    this.days = Math.min(Math.max(days, 1), this.MAX_DAYS);
    f.endHint.textContent =
      days < 1 ? "回程日不能早於出發日，已調整" : days > this.MAX_DAYS ? `整趟旅程最多 ${this.MAX_DAYS} 天，回程日已調整` : "天數由出發日和回程日決定";
    this.renderSummary();
  },

  renderSummary() {
    const f = this.fields;
    const total = this.days;
    /* 回程日永遠等於出發日 + 天數 − 1 */
    if (f.date.value) {
      f.end.value = Trip.utils.addDays(f.date.value, total - 1);
      f.end.min = f.date.value;
      f.end.max = Trip.utils.addDays(f.date.value, this.MAX_DAYS - 1);
    }
    if (!f.date.value) {
      f.summary.textContent = `共 ${total} 天 ${total - 1} 夜`;
      return;
    }
    const { formatDate, addDays } = Trip.utils;
    const start = formatDate(f.date.value);
    const end = formatDate(addDays(f.date.value, total - 1));
    f.summary.textContent = `共 ${total} 天 ${total - 1} 夜 · ${start.md}（${start.weekday}）– ${end.md}（${end.weekday}）`;
  },

  /* ---------- 建立 ---------- */

  validate() {
    if (!this.country) return "請選擇國家";
    if (this.days > this.MAX_DAYS) return `整趟旅程最多 ${this.MAX_DAYS} 天`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.fields.date.value)) return "請選擇出發日";
    return "";
  },

  async save() {
    const problem = this.validate();
    if (problem) {
      this.message(problem, "error");
      return;
    }

    const photo = this.photo.state();
    if (photo.busy) {
      this.message("照片還在處理中，請稍等一下", "pending");
      return;
    }

    await this.saveLocal(this.buildDest(), photo.blob);
  },

  /* 存在這台裝置：加入清單後直接打開這趟行程 */
  async saveLocal(dest, photoBlob) {
    const trip = Trip.localTrips.add({
      ...dest,
      id: Trip.localTrips.newId(),
      checklist: [...Trip.config.checklistBefore, ...Trip.config.checklistAfter],
    });
    if (!trip) {
      this.message("這個瀏覽器不允許儲存資料（例如無痕模式），無法建立行程", "error");
      return;
    }
    let note = "";
    if (photoBlob) {
      try {
        await Trip.photos.setCover(trip, photoBlob);
      } catch (err) {
        note = `（照片沒有存成功：${err.message}）`;
      }
    }
    this.dialog.close();
    Trip.picker.render();
    location.hash = `#/${encodeURIComponent(trip.id)}`;
    Trip.addItem.toast(`已建立「${trip.title}」${note}`);
  },

  /* 把表單內容組成一趟行程（存在這台裝置） */
  buildDest() {
    const { code, name: country, flag } = this.country;
    const meta = this.data.countries[country] || {};
    const city = this.city?.name || "";
    /* 文字裡的地名：有城市用城市，沒有就用國家 */
    const where = city || country;
    const title = this.fields.title.value.trim() || `${country}小旅行`;
    /* 城市的經緯度與機場（新增航班時自動帶入機場） */
    const places = city && this.city.place ? { [city]: this.city.place } : {};

    /* 每天記下國家（每日行程裡可以各自改國家、城市） */
    const countryOfDay = { country, countryCode: code };
    const last = this.days - 1;
    const days = Array.from({ length: this.days }, (_, i) => {
      if (i === 0) {
        const items = [{ time: "", title: `抵達${where}`, note: "填好航班後可以補上時間", transport: ["flight"], must: false }];
        if (last === 0) items.push({ time: "", title: "起飛回台北", note: "", transport: ["flight"], must: false });
        return { ...countryOfDay, city, theme: `抵達${where}`, items };
      }
      if (i === last) {
        return { ...countryOfDay, city, theme: "最後採買 · 回家", items: [{ time: "", title: "起飛回台北", note: "", transport: ["flight"], must: false }] };
      }
      return { ...countryOfDay, city, theme: `${where}自由行`, items: [{ time: "10:00", title: `${where}景點（待填）`, note: "", transport: [], must: false }] };
    });

    /* 常用城市的專屬插圖 */
    const first = Trip.places.knownCity(city, code) || {};

    return {
      id: meta.id || code.toLowerCase(),
      name: country,
      flag: meta.flag || flag,
      places,
      title,
      tagline: where,
      art: first.art || "heroGeneric",
      startDate: this.fields.date.value,
      /* 航班一開始不帶資料，之後在行程頁按「＋ 新增航班」 */
      flights: {},
      days,
      lodgings: [{
        city, name: `${where}住宿（待填）`, address: "", room: "",
        checkInTime: "15:00", checkOutTime: "11:00", bookingNo: "", phone: "", mapQuery: where,
      }],
      checklist: [],
    };
  },

  setSaving(saving) {
    this.saving = saving;
    const f = this.fields;
    f.submit.disabled = saving;
    f.cancel.disabled = saving;
    f.submit.textContent = saving ? "建立中…" : "建立行程";
  },

  message(text, type = "pending") {
    Trip.api.renderMessage(this.fields.msg, text, type);
  },
};
