/* ============================================================
   航班：一開始是空的，使用者自己新增；之後可以編輯、刪除
   - 存在這台裝置的行程：存在這台裝置
   - Notion 同步的行程（需登入）：寫進 Notion 的「航班」表
   機場依行程城市預先帶入（去程：台灣 → 第一天的城市；回程：最後一天的城市 → 台灣）
   去程、回程各一筆；兩筆都有時「新增航班」自動隱藏（存檔都走 js/core/editor.js）
   網站有設定航班查詢時（Cloudflare），填好航班號碼會自動查真實航班，帶入機型、航廈、起降時間
   ============================================================ */
window.Trip = window.Trip || {};

Trip.addFlight = {
  HOME: { code: "TPE", city: "台北桃園" },
  TYPES: [
    { type: "去程", key: "outbound" },
    { type: "回程", key: "inbound" },
  ],

  init() {
    const $ = (id) => document.getElementById(id);
    this.openButton = $("add-flight-open");
    this.empty = $("flight-empty");
    this.hint = $("flight-hint");
    this.dialog = $("add-flight-dialog");
    this.form = $("add-flight-form");
    if (!this.dialog || !this.form) return;

    this.heading = $("add-flight-title");
    this.remove = $("add-flight-delete");
    const field = (name) => $(`add-flight-${name}`);
    this.f = Object.fromEntries(
      ["type", "number", "airline", "aircraft", "lookup", "from-code", "from-city", "from-time", "from-terminal",
        "to-code", "to-city", "to-time", "to-terminal", "duration", "baggage", "passengers", "passenger-add", "date", "msg", "submit"]
        .map((name) => [name, field(name)])
    );

    this.openButton.addEventListener("click", () => this.open());
    $("add-flight-cancel").addEventListener("click", () => this.dialog.close());
    this.remove.addEventListener("click", () => this.confirmDelete());
    this.f.type.addEventListener("change", () => {
      this.applyTypeDefaults();
      this.scheduleLookup(0);
    });

    /* 旅客：每列一位（姓名＋座位），可以新增、移除 */
    this.f["passenger-add"].addEventListener("click", () => {
      this.addPassenger();
      this.f.passengers.lastElementChild?.querySelector("input")?.focus();
    });
    this.f.passengers.addEventListener("click", (e) => {
      const button = e.target.closest(".passenger-remove");
      if (!button) return;
      button.closest("li").remove();
      this.refreshPassengerAdd();
    });

    /* 填航班號碼時自動帶入航空公司（使用者自己改過就不覆蓋） */
    this.f.number.addEventListener("input", () => {
      this.message("");
      const code = Trip.airlineCode(this.f.number.value);
      if (code && (!this.f.airline.value || this.airlineAuto)) {
        this.f.airline.value = Trip.airlines[code];
        this.airlineAuto = true;
      }
      this.scheduleLookup();
    });
    this.f.airline.addEventListener("input", () => {
      this.airlineAuto = false;
    });

    /* 使用者自己改過的欄位，查詢結果不會覆蓋 */
    this.form.addEventListener("input", (e) => {
      const name = e.target.id?.replace("add-flight-", "");
      if (name && name !== "number") this.touched.add(name);
    });

    /* 航班卡片上的「編輯」（卡片由 js/modules/flights.js 產生） */
    document.getElementById("flight-list")?.addEventListener("click", (e) => {
      const button = e.target.closest("[data-edit-flight]");
      if (button) this.openEdit(button.dataset.editFlight);
    });

    this.form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.save();
    });
    this.dialog.addEventListener("click", (e) => {
      if (e.target === this.dialog && !this.saving) this.dialog.close();
    });
  },

  render(trip) {
    this.trip = trip;
    this.refresh();
  },

  /* 可以編輯：自己在這台裝置建立的行程，或已登入 Notion 的 Notion 行程 */
  editable() {
    const dest = Trip.state.destination;
    return Trip.editor.canEdit(dest) && !Trip.editor.needsResync(dest);
  },

  missingTypes() {
    const flights = Trip.state.destination?.flights || {};
    return this.TYPES.filter((t) => !flights[t.key]);
  },

  refresh() {
    if (!this.openButton || !this.trip) return;
    const editable = this.editable();
    this.openButton.hidden = !editable || !this.missingTypes().length;
    this.empty.hidden = Boolean(this.trip.flights.length);
    this.hint.textContent = editable
      ? "按「＋ 新增航班」填入去程與回程"
      : Trip.state.destination?.notionPageId
        ? "用 Notion 登入後可以新增航班，或直接在 Notion 的「航班」表填寫"
        : "";
  },

  /* ---------- 對話框 ---------- */

  /* 新增：只能選還沒有的去程／回程 */
  async open() {
    this.editing = null;
    await this.prepare(this.missingTypes());
    this.applyTypeDefaults();
    this.show("新增航班", "新增航班");
  },

  /* 編輯：類型固定，帶入原本的資料 */
  async openEdit(type) {
    const t = this.TYPES.find((x) => x.type === type);
    const flight = Trip.state.destination.flights?.[t?.key];
    if (!flight) return;
    this.editing = { type, uid: flight.uid };
    await this.prepare([t]);

    const set = (name, value) => {
      this.f[name].value = value || "";
    };
    set("number", flight.number);
    set("airline", flight.airline);
    set("aircraft", flight.aircraft);
    set("from-code", flight.from?.code);
    set("from-city", flight.from?.city);
    set("from-time", flight.from?.time);
    set("from-terminal", flight.from?.terminal);
    set("to-code", flight.to?.code);
    set("to-city", flight.to?.city);
    set("to-time", flight.to?.time);
    set("to-terminal", flight.to?.terminal);
    set("duration", flight.duration);
    set("baggage", flight.baggage);
    /* 舊資料只有一個座位：放進第一位旅客 */
    const passengers = flight.passengers?.length ? flight.passengers : flight.seat ? [{ name: "", seat: flight.seat }] : [];
    passengers.forEach((p) => this.addPassenger(p));
    this.showDate();
    this.show(`編輯${type}航班`, "儲存");
  },

  async prepare(types) {
    const { esc } = Trip.utils;
    this.f.type.innerHTML = types
      .map(
        (t, i) => `
<label class="chip">
  <input type="radio" name="flight-type" value="${t.type}" ${i === 0 ? "checked" : ""}>
  <span class="pill ${t.type === "去程" ? "tone-peach" : "tone-sky"}">${esc(t.type)}</span>
</label>`
      )
      .join("");
    for (const name of ["number", "airline", "aircraft", "from-time", "from-terminal", "to-time", "to-terminal", "duration", "baggage"]) {
      this.f[name].value = "";
    }
    this.f.passengers.innerHTML = "";
    this.refreshPassengerAdd();
    this.airlineAuto = false;
    this.touched = new Set();
    clearTimeout(this.lookupTimer);
    this.lookupSeq = (this.lookupSeq || 0) + 1;
    this.lookupHint("");

    /* 城市的機場代碼要讀城市清單；讀不到也能手動填 */
    try {
      this.cities = (await Trip.utils.cities()).cities;
    } catch {
      this.cities = [];
    }
  },

  show(heading, submitLabel) {
    this.heading.textContent = heading;
    this.submitLabel = submitLabel;
    this.remove.hidden = !this.editing;
    Trip.tripDelete.reset(this.remove, "刪除");
    this.message("");
    this.setSaving(false);
    this.dialog.showModal();
    this.f.number.focus();
  },

  selectedType() {
    return this.f.type.querySelector("input:checked")?.value || "去程";
  },

  /* 依去程／回程預先帶入機場與城市 */
  applyTypeDefaults() {
    const days = this.trip.days;
    const outbound = this.selectedType() === "去程";
    const cityName = outbound ? days[0].city : days[days.length - 1].city;
    const city = this.cities.find((c) => c.name === cityName);
    const there = { code: city?.airport || "", city: cityName || "" };
    const [from, to] = outbound ? [this.HOME, there] : [there, this.HOME];

    this.f["from-code"].value = from.code;
    this.f["from-city"].value = from.city;
    this.f["to-code"].value = to.code;
    this.f["to-city"].value = to.city;
    this.showDate();
  },

  showDate() {
    const { formatDate } = Trip.utils;
    const days = this.trip.days;
    const outbound = this.selectedType() === "去程";
    const date = formatDate(outbound ? days[0].date : days[days.length - 1].date);
    this.f.date.textContent = `航班日期：${date.md}（${date.weekday}）· 依行程的${outbound ? "第一天" : "最後一天"}`;
  },

  collect() {
    const v = (name) => this.f[name].value.trim();
    return {
      type: this.selectedType(),
      number: v("number").toUpperCase(),
      airline: v("airline"),
      aircraft: v("aircraft"),
      from: { code: v("from-code").toUpperCase(), city: v("from-city"), time: v("from-time"), terminal: v("from-terminal") },
      to: { code: v("to-code").toUpperCase(), city: v("to-city"), time: v("to-time"), terminal: v("to-terminal") },
      duration: v("duration"),
      baggage: v("baggage"),
      passengers: this.collectPassengers(),
    };
  },

  /* ---------- 查詢真實航班 ---------- */

  lookupAvailable() {
    return Boolean(Trip.notionPanel?.status?.flightLookup);
  },

  flightDate() {
    const days = this.trip.days;
    return this.selectedType() === "去程" ? days[0].date : days[days.length - 1].date;
  },

  /* 打字停下來一下再查，避免每打一個字就查一次 */
  scheduleLookup(delay = 700) {
    clearTimeout(this.lookupTimer);
    if (!this.lookupAvailable() || !this.dialog.open) return;
    const number = this.f.number.value.replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(number)) {
      this.lookupHint("");
      return;
    }
    this.lookupTimer = setTimeout(() => this.lookup(number), delay);
  },

  async lookup(number) {
    const seq = ++this.lookupSeq;
    const date = this.flightDate();
    this.lookupHint(`查詢 ${number}（${date}）的航班資料…`);
    try {
      const { flight } = await Trip.notionPanel.request("POST", "flights/lookup", {
        number, date, from: this.selectedType() === "去程" ? this.HOME.code : this.f["from-code"].value.trim(),
      });
      if (seq !== this.lookupSeq) return;
      if (!flight) {
        this.lookupHint(`查不到 ${number} 在 ${date} 的航班，請手動填寫（日期太遠的航班可能還沒公布）`);
        return;
      }
      const filled = this.applyLookup(flight);
      this.lookupHint(filled.length ? `已自動帶入：${filled.join("、")}（可以再修改）` : "查到航班，但沒有新的資料可以帶入");
    } catch (err) {
      if (seq === this.lookupSeq) this.lookupHint(err.message || "航班查詢失敗，請手動填寫");
    }
  },

  /* 把查到的資料填進還沒被使用者改過的欄位，回傳填了哪些 */
  applyLookup(flight) {
    const filled = new Set();
    const fill = (name, value, label) => {
      if (!value || this.touched.has(name) || this.f[name].value === value) return;
      this.f[name].value = value;
      filled.add(label);
    };
    /* 航空公司：已經依航班號碼帶入中文名稱就保留，空白才用查到的（英文）名稱 */
    if (!this.f.airline.value.trim()) fill("airline", flight.airline, "航空公司");
    fill("aircraft", flight.aircraft, "機型");
    for (const side of ["from", "to"]) {
      const p = flight[side] || {};
      if (p.code && p.code !== this.f[`${side}-code`].value.trim().toUpperCase() && !this.touched.has(`${side}-code`)) {
        fill(`${side}-code`, p.code, "機場");
        fill(`${side}-city`, this.cityName(p.code, p.city), "機場");
      }
      fill(`${side}-time`, p.time, "起降時間");
      fill(`${side}-terminal`, p.terminal, side === "from" ? "出發航廈" : "抵達航廈");
    }
    fill("duration", flight.duration, "飛行時間");
    return [...filled];
  },

  /* 機場代碼換成網頁上的中文城市名（沒有就用查到的英文名） */
  cityName(code, fallback) {
    if (code === this.HOME.code) return this.HOME.city;
    return this.cities.find((c) => c.airport === code)?.name || fallback || "";
  },

  lookupHint(text) {
    this.f.lookup.textContent = text;
    this.f.lookup.hidden = !text;
  },

  /* ---------- 旅客 ---------- */

  MAX_PASSENGERS: 20,

  addPassenger({ name = "", seat = "" } = {}) {
    const { esc } = Trip.utils;
    const n = this.f.passengers.children.length + 1;
    this.f.passengers.insertAdjacentHTML(
      "beforeend",
      `
<li class="passenger-row">
  <input class="passenger-name" maxlength="30" placeholder="旅客姓名" aria-label="第 ${n} 位旅客姓名" autocomplete="off" value="${esc(name)}">
  <input class="passenger-seat" maxlength="10" placeholder="座位" aria-label="第 ${n} 位旅客座位" autocapitalize="characters" autocomplete="off" value="${esc(seat)}">
  <button class="passenger-remove" type="button" aria-label="移除這位旅客">✕</button>
</li>`
    );
    this.refreshPassengerAdd();
  },

  refreshPassengerAdd() {
    this.f["passenger-add"].hidden = this.f.passengers.children.length >= this.MAX_PASSENGERS;
  },

  /* 姓名和座位都空白的列不存 */
  collectPassengers() {
    return [...this.f.passengers.children]
      .map((li) => ({
        name: li.querySelector(".passenger-name").value.trim(),
        seat: li.querySelector(".passenger-seat").value.trim().toUpperCase(),
      }))
      .filter((p) => p.name || p.seat);
  },

  async save() {
    const flight = this.collect();
    if (!flight.number) {
      this.message("請填寫航班號碼", "error");
      this.f.number.focus();
      return;
    }
    const editing = this.editing;
    await this.run(async () => {
      await Trip.editor.run(Trip.state.destination, {
        table: "flights",
        op: editing ? "update" : "create",
        uid: editing?.uid,
        values: flight,
        mutate: (d, id, row) => Trip.mutate.setFlight(d, id, row),
      });
      this.finish(`${editing ? "已更新" : "已新增"}${flight.type}航班 ${flight.number}`);
    });
  },

  async confirmDelete() {
    if (!Trip.tripDelete.confirm(this.remove, "刪除")) return;
    const { type, uid } = this.editing;
    await this.run(async () => {
      await Trip.editor.run(Trip.state.destination, {
        table: "flights",
        op: "delete",
        uid,
        mutate: (d) => Trip.mutate.removeFlight(d, type),
      });
      this.finish(`已刪除${type}航班`);
    });
  },

  async run(action) {
    this.setSaving(true);
    this.message(Trip.state.destination.notionPageId ? "儲存到 Notion…" : "儲存中…", "pending");
    try {
      await action();
    } catch (err) {
      this.setSaving(false);
      this.message(err.status === 401 ? "Notion 登入已過期，請到「選擇行程」頁重新登入" : err.message, "error");
    }
  },

  /* 完成：關閉對話框、重畫行程（航班卡片、倒數都會更新） */
  finish(text) {
    this.dialog.close();
    Trip.editor.rerender();
    document.getElementById("flights")?.scrollIntoView({ behavior: Trip.utils.prefersReducedMotion() ? "auto" : "smooth" });
    Trip.addItem.toast(text);
  },

  setSaving(saving) {
    this.saving = saving;
    this.f.submit.disabled = saving;
    this.remove.disabled = saving;
    this.f.submit.textContent = saving ? "儲存中…" : this.submitLabel || "新增航班";
  },

  message(text, type = "pending") {
    Trip.notionPanel.renderMessage(this.f.msg, text, type);
  },
};
