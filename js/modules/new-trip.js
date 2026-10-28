/* ============================================================
   新增行程（整趟旅程）：選國家 → 城市與每個城市的天數 → 出發日 → 標題
   先填好每天的預設行程、每個城市的住宿；航班之後在行程頁按「＋ 新增航班」
   行程存在這台裝置的瀏覽器；之後可以轉成共編，或匯出到 Notion
   可以選一張封面照片（js/core/photos.js，照片存在這台裝置）
   ============================================================ */
window.Trip = window.Trip || {};

Trip.newTrip = {
  MAX_DAYS: 30,

  init() {
    const $ = (id) => document.getElementById(id);
    this.dialog = $("new-trip-dialog");
    this.form = $("new-trip-form");
    if (!this.dialog || !this.form) return;

    this.fields = {
      country: $("new-trip-country"),
      stops: $("new-trip-stops"),
      addCity: $("new-trip-add-city"),
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
    f.country.addEventListener("change", () => this.chooseCountry(f.country.value));
    f.addCity.addEventListener("change", () => {
      if (f.addCity.value) this.stops.push({ city: f.addCity.value, days: 2 });
      this.renderStops();
    });
    f.stops.addEventListener("click", (e) => {
      const button = e.target.closest("button[data-index]");
      if (!button) return;
      const index = Number(button.dataset.index);
      if (button.dataset.step) {
        const stop = this.stops[index];
        stop.days = Math.min(Math.max(stop.days + Number(button.dataset.step), 1), this.MAX_DAYS);
      } else {
        this.stops.splice(index, 1);
      }
      this.renderStops();
    });
    /* 出發日：天數不變，回程日跟著移動；回程日：調整最後一個城市的天數 */
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
      this.data ||= await Trip.utils.cities();
    } catch (err) {
      this.message(`讀不到城市清單：${err.message}`, "error");
      return;
    }

    const { esc } = Trip.utils;
    const countries = [...new Set(this.data.cities.map((c) => c.country))];
    f.country.innerHTML = countries
      .map((name) => `<option value="${esc(name)}">${esc(this.data.countries[name]?.flag || "")} ${esc(name)}</option>`)
      .join("");
    const first = countries[0];

    /* 出發日預設一個月後 */
    const today = Trip.utils.todayIso();
    f.date.min = today;
    f.date.value = Trip.utils.addDays(today, 30);
    this.titleEdited = false;
    f.country.value = first;
    this.chooseCountry(first);
  },

  /* 換國家：先放這個國家的第一個城市 3 天 */
  chooseCountry(country) {
    this.country = country;
    const cities = this.citiesOf(country);
    this.stops = cities.length ? [{ city: cities[0].name, days: 3 }] : [];
    if (!this.titleEdited) this.fields.title.value = `${country}小旅行`;
    this.renderStops();
  },

  citiesOf(country) {
    return this.data.cities.filter((c) => c.country === country);
  },

  renderStops() {
    const { esc } = Trip.utils;
    const f = this.fields;

    f.stops.innerHTML = this.stops
      .map(
        (s, i) => `
<li class="stop">
  <span class="stop__city">${esc(s.city)}</span>
  <span class="stepper">
    <button type="button" data-index="${i}" data-step="-1" aria-label="${esc(s.city)}少一天" ${s.days <= 1 ? "disabled" : ""}>−</button>
    <output aria-live="polite">${s.days} 天</output>
    <button type="button" data-index="${i}" data-step="1" aria-label="${esc(s.city)}多一天" ${s.days >= this.MAX_DAYS ? "disabled" : ""}>＋</button>
  </span>
  <button class="stop__remove" type="button" data-index="${i}" aria-label="移除${esc(s.city)}">✕</button>
</li>`
      )
      .join("");

    const chosen = new Set(this.stops.map((s) => s.city));
    const rest = this.citiesOf(this.country).filter((c) => !chosen.has(c.name));
    f.addCity.innerHTML =
      `<option value="">＋ 加入城市</option>` + rest.map((c) => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");
    f.addCity.hidden = !rest.length;
    f.addCity.value = "";

    this.renderSummary();
  },

  totalDays() {
    return this.stops.reduce((n, s) => n + s.days, 0);
  },

  /* 依回程日算出總天數，多退少補在最後的城市（每個城市至少 1 天） */
  applyEndDate() {
    const f = this.fields;
    const days = Trip.utils.daysBetween(f.date.value, f.end.value) + 1;
    if (!this.stops.length || !Number.isFinite(days)) return this.renderSummary();
    const min = this.stops.length;
    const target = Math.min(Math.max(days, min), this.MAX_DAYS);
    let diff = target - this.totalDays();
    for (let i = this.stops.length - 1; diff !== 0 && i >= 0; i--) {
      const stop = this.stops[i];
      const next = Math.max(1, stop.days + diff);
      diff -= next - stop.days;
      stop.days = next;
    }
    f.endHint.textContent =
      days < min ? `${this.stops.length} 個城市至少要 ${min} 天，回程日已調整` : days > this.MAX_DAYS ? `整趟旅程最多 ${this.MAX_DAYS} 天，回程日已調整` : "改回程日會調整最後一個城市的天數";
    this.renderStops();
  },

  renderSummary() {
    const f = this.fields;
    const total = this.totalDays();
    /* 回程日永遠等於出發日 + 天數 − 1 */
    if (f.date.value && total) {
      f.end.value = Trip.utils.addDays(f.date.value, total - 1);
      f.end.min = Trip.utils.addDays(f.date.value, Math.max(this.stops.length - 1, 0));
      f.end.max = Trip.utils.addDays(f.date.value, this.MAX_DAYS - 1);
    }
    if (!total || !f.date.value) {
      f.summary.textContent = total ? `共 ${total} 天 ${total - 1} 夜` : "請至少選一個城市";
      return;
    }
    const { formatDate, addDays } = Trip.utils;
    const start = formatDate(f.date.value);
    const end = formatDate(addDays(f.date.value, total - 1));
    f.summary.textContent = `共 ${total} 天 ${total - 1} 夜 · ${start.md}（${start.weekday}）– ${end.md}（${end.weekday}）`;
  },

  /* ---------- 建立 ---------- */

  validate() {
    const total = this.totalDays();
    if (!this.stops.length) return "請至少選一個城市";
    if (total > this.MAX_DAYS) return `整趟旅程最多 ${this.MAX_DAYS} 天`;
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
    const country = this.country;
    const meta = this.data.countries[country] || {};
    const info = (name) => this.data.cities.find((c) => c.name === name) || {};
    const title = this.fields.title.value.trim() || `${country}小旅行`;

    const cities = this.stops.flatMap((s) => Array(s.days).fill(s.city));
    const last = cities.length - 1;
    const days = cities.map((city, i) => {
      if (i === 0) {
        const items = [{ time: "", title: `抵達${city}`, note: "填好航班後可以補上時間", transport: ["flight"], must: false }];
        if (last === 0) items.push({ time: "", title: "起飛回台北", note: "", transport: ["flight"], must: false });
        return { city, theme: `抵達${city}`, items };
      }
      if (i === last) {
        return { city, theme: "最後採買 · 回家", items: [{ time: "", title: "起飛回台北", note: "", transport: ["flight"], must: false }] };
      }
      if (cities[i - 1] !== city) {
        return { city, theme: `前往${city}`, items: [{ time: "09:00", title: `前往${city}`, note: "", transport: ["train"], must: false }] };
      }
      return { city, theme: `${city}自由行`, items: [{ time: "10:00", title: `${city}景點（待填）`, note: "", transport: [], must: false }] };
    });

    const first = info(cities[0]);

    return {
      id: meta.id || country,
      name: country,
      flag: meta.flag || "",
      title,
      tagline: this.stops.map((s) => s.city).join("、"),
      art: first.art || "heroGeneric",
      startDate: this.fields.date.value,
      /* 航班一開始不帶資料，之後在行程頁按「＋ 新增航班」 */
      flights: {},
      days,
      lodgings: [...new Set(cities)].map((city) => ({
        city, name: `${city}住宿（待填）`, address: "", room: "",
        checkInTime: "15:00", checkOutTime: "11:00", bookingNo: "", phone: "", mapQuery: city,
      })),
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
