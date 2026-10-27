/* ============================================================
   新增行程（整趟旅程）：選國家 → 城市與每個城市的天數 → 出發日 → 標題
   先填好每天的預設行程、每個城市的住宿、去回程航班（機場依城市自動帶入）
   - 已登入 Notion：建立到使用者自己的 Notion（國家頁面＋5 張表）
   - 沒有 Notion（例如 GitHub Pages）：存在這台裝置的瀏覽器
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
      title: $("new-trip-name"),
      summary: $("new-trip-summary"),
      msg: $("new-trip-msg"),
      submit: $("new-trip-submit"),
      cancel: $("new-trip-cancel"),
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
    f.date.addEventListener("change", () => this.renderSummary());
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

  /* 已登入 Notion 並選好上層頁面時存到 Notion，否則存在這台裝置 */
  usesNotion() {
    const panel = Trip.notionPanel;
    return Boolean(panel?.status?.loggedIn && panel.parent && panel.scan);
  },

  refresh() {
    const card = document.getElementById("new-trip-open");
    if (!card) return;
    card.hidden = location.protocol === "file:";
    card.querySelector(".trip-card__meta").textContent = this.usesNotion()
      ? "選國家、城市與天數，建立到你的 Notion"
      : "選國家、城市與天數，存在這台裝置";
  },

  /* ---------- 對話框 ---------- */

  async open() {
    const f = this.fields;
    this.message("");
    this.setSaving(false);
    this.dialog.showModal();

    try {
      this.data ||= await fetch("js/data/cities.json").then((res) => {
        if (!res.ok) throw new Error(`連線錯誤（${res.status}）`);
        return res.json();
      });
    } catch (err) {
      this.message(`讀不到城市清單：${err.message}`, "error");
      return;
    }

    const { esc } = Trip.utils;
    /* Notion 一個國家一個頁面；存在這台裝置則不限制 */
    const existing = new Set(this.usesNotion() ? Trip.notionPanel.scan.countries.map((c) => c.title) : []);
    const countries = [...new Set(this.data.cities.map((c) => c.country))];
    f.country.innerHTML = countries
      .map((name) => {
        const flag = this.data.countries[name]?.flag || "";
        const taken = existing.has(name);
        return `<option value="${esc(name)}" ${taken ? "disabled" : ""}>${esc(flag)} ${esc(name)}${taken ? "（已有頁面）" : ""}</option>`;
      })
      .join("");

    const first = countries.find((c) => !existing.has(c));
    if (!first) {
      this.message("每個國家都已經有頁面了；要再規劃同一個國家，請到 Notion 修改那個國家頁面", "error");
      f.submit.disabled = true;
      return;
    }

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

  renderSummary() {
    const f = this.fields;
    const total = this.totalDays();
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
    if (this.usesNotion() && Trip.notionPanel.scan.countries.some((c) => c.title === this.country)) {
      return `「${this.country}」已經有頁面了`;
    }
    return "";
  },

  async save() {
    const problem = this.validate();
    if (problem) {
      this.message(problem, "error");
      return;
    }

    const dest = this.buildDest();
    if (!this.usesNotion()) {
      this.saveLocal(dest);
      return;
    }

    const panel = Trip.notionPanel;
    const report = (...args) => panel.renderMessage(this.fields.msg, ...args);
    this.setSaving(true);
    try {
      await panel.createTrip(dest, panel.scan.countries.length + 1, report);
      /* 同步完成重新載入時，直接打開這趟新行程 */
      history.replaceState(null, "", `${location.pathname}#/${encodeURIComponent(dest.id)}`);
      await panel.sync(report);
      this.setSaving(false);
    } catch (err) {
      this.setSaving(false);
      this.message(`${err.message}（已建立的內容會保留在 Notion）`, "error");
    }
  },

  /* 存在這台裝置：加入清單後直接打開這趟行程 */
  saveLocal(dest) {
    const trip = Trip.localTrips.add({
      ...dest,
      id: Trip.localTrips.newId(),
      checklist: [...Trip.config.checklistBefore, ...Trip.config.checklistAfter],
    });
    if (!trip) {
      this.message("這個瀏覽器不允許儲存資料（例如無痕模式），無法建立行程", "error");
      return;
    }
    this.dialog.close();
    Trip.picker.render();
    location.hash = `#/${encodeURIComponent(trip.id)}`;
    Trip.addItem.toast(`已建立「${trip.title}」`);
  },

  /* 把表單內容組成和內建範例相同格式的行程（存到 Notion 或這台裝置） */
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
    const end = info(cities[last]);
    const flight = (number, from, to) => ({
      airline: "", number, duration: "", seat: "", baggage: "",
      from: { code: from.airport || "", city: from.name || "", time: "", terminal: "" },
      to: { code: to.airport || "", city: to.name || "", time: "", terminal: "" },
    });
    const home = { airport: "TPE", name: "台北桃園" };

    return {
      id: meta.id || country,
      name: country,
      flag: meta.flag || "",
      title,
      tagline: this.stops.map((s) => s.city).join("、"),
      art: first.art || "heroGeneric",
      startDate: this.fields.date.value,
      flights: {
        outbound: flight("去程航班（待填）", home, first),
        inbound: flight("回程航班（待填）", end, home),
      },
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
    f.submit.textContent = saving ? "建立中…" : this.usesNotion() ? "建立到 Notion" : "建立行程";
  },

  message(text, type = "pending") {
    Trip.notionPanel.renderMessage(this.fields.msg, text, type);
  },
};
