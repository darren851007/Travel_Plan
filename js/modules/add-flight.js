/* ============================================================
   航班：一開始是空的，使用者自己新增；之後可以編輯、刪除
   - 存在這台裝置的行程：存在這台裝置；共編行程：存到共編房間
   機場依行程城市預先帶入（去程：台灣 → 第一天的城市；回程：最後一天的城市 → 台灣）
   去程、回程各一筆；兩筆都有時「新增航班」自動隱藏（存檔都走 js/core/editor.js）
   網站有設定航班查詢時（Cloudflare），填好航班號碼會自動查真實航班，帶入機型、航廈、起降時間
   有轉機時可以加「轉機航班」（connections）：第一段是航班本身，之後每段一筆
   「段」（segment）＝第一段或某一段轉機，查詢、自動帶入都用同一套
   ============================================================ */
window.Trip = window.Trip || {};

Trip.addFlight = {
  HOME: { code: "TPE", city: "台北桃園" },
  MAX_LEGS: 3,
  /* 每一段都有的欄位（第一段的 id 是 add-flight-<名稱>，轉機段用 data-field） */
  SEGMENT_FIELDS: ["number", "airline", "aircraft", "from-code", "from-city", "from-time", "from-terminal",
    "to-code", "to-city", "to-time", "to-terminal", "duration"],
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
        "to-code", "to-city", "to-time", "to-terminal", "duration", "passengers", "passenger-add",
        "legs", "leg-add", "date", "msg", "submit"]
        .map((name) => [name, field(name)])
    );

    this.openButton.addEventListener("click", () => this.open());
    $("add-flight-cancel").addEventListener("click", () => this.dialog.close());
    this.remove.addEventListener("click", () => this.confirmDelete());
    this.f.type.addEventListener("change", () => {
      this.applyTypeDefaults();
      this.segments().forEach((seg) => this.scheduleLookup(seg, 0));
    });

    /* 轉機航班：新增、移除 */
    this.f["leg-add"].addEventListener("click", () => {
      const leg = this.addLeg({}, { moveDestination: true });
      leg.get("number").focus();
    });
    this.f.legs.addEventListener("click", (e) => {
      const button = e.target.closest(".leg-remove");
      if (button) this.removeLeg(button.closest(".leg"));
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

    /* 打字時：
       - 航班號碼：自動帶入航空公司（使用者自己改過就不覆蓋），停一下再查真實航班
       - 其他欄位：記下「使用者改過」，查詢結果不會覆蓋
       - 改了某段的抵達機場：下一段的出發機場跟著填（下一段自己改過就不動） */
    this.form.addEventListener("input", (e) => {
      const seg = this.segmentOf(e.target);
      const name = seg && this.fieldName(e.target);
      if (!name) return;
      if (name === "number") {
        this.message("");
        const code = Trip.airlineCode(e.target.value);
        const airline = seg.get("airline");
        if (code && (!airline.value || airline.dataset.auto)) {
          airline.value = Trip.airlines[code];
          airline.dataset.auto = "1";
        }
        this.scheduleLookup(seg);
        return;
      }
      e.target.dataset.touched = "1";
      if (name === "airline") delete e.target.dataset.auto;
      if (name === "to-code" || name === "to-city") {
        const next = this.segments()[this.segments().findIndex((s) => s.el === seg.el) + 1];
        const target = next?.get(name.replace("to-", "from-"));
        if (target && !target.dataset.touched) target.value = e.target.value;
      }
    });

    /* 航班卡片上的「編輯」（卡片由 js/modules/flights.js 產生） */
    document.getElementById("flight-list")?.addEventListener("click", (e) => {
      const button = e.target.closest("[data-edit-flight]");
      if (button) this.openEdit(button.dataset.editFlight, button.dataset.passenger);
    });

    /* 那天查不到這班航班的提示：帶入最近一班，或自己填 */
    this.missing = $("flight-missing-dialog");
    this.missingText = $("flight-missing-text");
    this.missingNearest = $("flight-missing-nearest");
    $("flight-missing-manual").addEventListener("click", () => {
      this.missing.close();
      this.missingSeg.hint("請手動填寫航班資料");
      this.missingSeg.get("number").focus();
    });
    this.missingNearest.addEventListener("click", () => {
      this.missing.close();
      this.lookup(this.missingSeg, this.missingNumber, { nearest: true });
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

  /* 可以編輯：自己在這台裝置建立的行程，或已連上的共編行程 */
  editable() {
    const dest = Trip.state.destination;
    return Trip.editor.canEdit(dest);
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
    this.hint.textContent = editable ? "按「＋ 新增航班」填入去程與回程" : "";
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
  /* passenger：從旅客 chip 點進來時，打開後跳到那位旅客 */
  async openEdit(type, passenger) {
    const t = this.TYPES.find((x) => x.type === type);
    const flight = Trip.state.destination.flights?.[t?.key];
    if (!flight) return;
    this.editing = { type, uid: flight.uid };
    await this.prepare([t]);

    this.fillSegment(this.mainSegment(), flight);
    (flight.connections || []).forEach((leg) => this.addLeg(leg));
    /* 舊資料：只有一個座位就放進第一位旅客；整個航班的行李（舊版）帶給每位還沒填行李的旅客 */
    const passengers = flight.passengers?.length ? flight.passengers : flight.seat || this.hasBaggage(this.baggageOf(flight)) ? [{ name: "", seat: flight.seat || "" }] : [];
    const shared = this.baggageOf(flight);
    passengers.forEach((p) => {
      const own = this.baggageOf(p);
      this.addPassenger({ ...p, ...(this.hasBaggage(own) ? {} : { baggageKg: shared.kg ?? "", baggagePieces: shared.pieces ?? "" }) });
    });
    this.showDate();
    this.show(`編輯${type}航班`, "儲存");
    const row = passenger != null ? this.f.passengers.children[Number(passenger)] : null;
    if (row) {
      row.scrollIntoView({ block: "center" });
      row.querySelector(".passenger-last").focus();
    }
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
    for (const name of this.SEGMENT_FIELDS) {
      if (name === "from-code" || name === "from-city" || name === "to-code" || name === "to-city") continue;
      this.f[name].value = "";
    }
    for (const name of this.SEGMENT_FIELDS) {
      delete this.f[name].dataset.touched;
      delete this.f[name].dataset.auto;
    }
    this.f.passengers.innerHTML = "";
    this.refreshPassengerAdd();
    this.f.legs.innerHTML = "";
    this.refreshLegs();
    const main = this.mainSegment();
    clearTimeout(main.state.timer);
    main.state.seq += 1;
    main.hint("");

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

  /* 去程／回程的起點與終點：去程 台灣 → 第一天的城市；回程 最後一天的城市 → 台灣 */
  endpoints() {
    const days = this.trip.days;
    const outbound = this.selectedType() === "去程";
    const cityName = outbound ? days[0].city : days[days.length - 1].city;
    /* 機場：建立行程時記下的（js/modules/new-trip.js 的 places），舊行程用常用城市清單 */
    const place = Trip.state.destination?.places?.[cityName];
    const city = this.cities.find((c) => c.name === cityName);
    const there = { code: place?.airport || city?.airport || "", city: cityName || "" };
    return outbound ? [this.HOME, there] : [there, this.HOME];
  },

  /* 依去程／回程預先帶入機場與城市 */
  applyTypeDefaults() {
    const [from, to] = this.endpoints();

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

  /* 一段的資料（第一段或轉機段共用） */
  segmentData(seg) {
    const v = (name) => seg.get(name).value.trim();
    return {
      number: v("number").toUpperCase(),
      airline: v("airline"),
      aircraft: v("aircraft"),
      from: { code: v("from-code").toUpperCase(), city: v("from-city"), time: v("from-time"), terminal: v("from-terminal") },
      to: { code: v("to-code").toUpperCase(), city: v("to-city"), time: v("to-time"), terminal: v("to-terminal") },
      duration: v("duration"),
    };
  },

  fillSegment(seg, data) {
    const value = {
      number: data.number, airline: data.airline, aircraft: data.aircraft,
      "from-code": data.from?.code, "from-city": data.from?.city, "from-time": data.from?.time, "from-terminal": data.from?.terminal,
      "to-code": data.to?.code, "to-city": data.to?.city, "to-time": data.to?.time, "to-terminal": data.to?.terminal,
      duration: data.duration,
    };
    for (const name of this.SEGMENT_FIELDS) seg.get(name).value = value[name] || "";
  },

  /* 託運行李（每位旅客各自）：每件公斤數與件數
     舊資料只有整個航班的文字（例如「託運 23kg」）時，從文字裡取出公斤數，件數算 1 */
  hasBaggage(bag) {
    return bag.kg !== null || bag.pieces !== null;
  },

  /* kg：使用者輸入的文字（例如「23」「23kg」「20+5 公斤」），原樣保留；pieces：件數（數字） */
  baggageOf(flight) {
    const num = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
    const kgText = (v) => (v === "" || v == null ? null : String(v).trim() || null);
    if (kgText(flight?.baggageKg) !== null || num(flight?.baggagePieces) !== null) {
      return { kg: kgText(flight.baggageKg), pieces: num(flight.baggagePieces) };
    }
    const kg = String(flight?.baggage || "").match(/(\d+(?:\.\d+)?)\s*(?:kg|公斤)/i)?.[1];
    return kg ? { kg, pieces: 1 } : { kg: null, pieces: null };
  },

  /* 「23 kg × 2 件」：公斤數照使用者輸入的顯示（只有數字就補上「kg」，沒填寫「— kg」），沒填件數算 1 件 */
  baggageText(flight, { compact = false } = {}) {
    const { kg, pieces } = this.baggageOf(flight);
    if (kg === null && pieces === null) return String(flight?.baggage || "");
    const unit = compact ? "kg" : " kg";
    const weight = kg === null ? `—${unit}` : /^\d+(?:[.,]\d+)?$/.test(kg) ? `${kg}${unit}` : kg;
    /* compact：旅客 chip 用的格式「23kg × 2 件」（數字和 kg 連在一起，比較短） */
    return `${weight} × ${pieces !== null ? pieces : 1} 件`;
  },

  /* 有沒有任何旅客填了自己的行李 */
  hasPersonalBaggage(flight) {
    return (flight.passengers || []).some((p) => this.hasBaggage(this.baggageOf(p)));
  },


  collect() {
    const passengers = this.collectPassengers();
    return {
      type: this.selectedType(),
      ...this.segmentData(this.mainSegment()),
      passengers,
      /* 行李改成每位旅客各自填，整個航班的舊欄位清掉 */
      baggageKg: "",
      baggagePieces: "",
      baggage: "",
      connections: this.legSegments().map((seg) => this.segmentData(seg)).filter((leg) => !this.isEmptyLeg(leg)),
    };
  },

  isEmptyLeg(leg) {
    return !leg.number && !leg.airline && !leg.to.code && !leg.from.code;
  },

  /* ---------- 每一段（第一段、轉機段） ---------- */

  /* 一段＝取欄位的方法＋提示文字＋查詢狀態 */
  mainSegment() {
    this.mainState ||= { seq: 0, timer: null };
    return {
      el: this.form,
      main: true,
      state: this.mainState,
      get: (name) => this.f[name],
      hint: (text) => this.lookupHint(text),
    };
  },

  legSegment(li) {
    li._state ||= { seq: 0, timer: null };
    const hint = li.querySelector(".leg-lookup");
    return {
      el: li,
      main: false,
      state: li._state,
      get: (name) => li.querySelector(`[data-field="${name}"]`),
      hint: (text) => {
        hint.textContent = text;
        hint.hidden = !text;
      },
    };
  },

  legSegments() {
    return [...this.f.legs.children].map((li) => this.legSegment(li));
  },

  segments() {
    return [this.mainSegment(), ...this.legSegments()];
  },

  segmentOf(el) {
    const li = el.closest?.(".leg");
    if (li) return this.legSegment(li);
    return el.id?.startsWith("add-flight-") ? this.mainSegment() : null;
  },

  fieldName(el) {
    const name = el.dataset.field || el.id?.replace("add-flight-", "");
    return this.SEGMENT_FIELDS.includes(name) ? name : null;
  },

  /* 新增一段轉機；moveDestination：把目前最後一段的抵達（目的地）移到新的一段 */
  addLeg(data = {}, { moveDestination = false } = {}) {
    const { esc } = Trip.utils;
    const input = (name, label, attrs = "") =>
      `<input data-field="${name}" aria-label="${esc(label)}" autocomplete="off" ${attrs}>`;
    this.f.legs.insertAdjacentHTML(
      "beforeend",
      `
<li class="leg">
  <div class="leg__head">
    <strong class="leg__title"></strong>
    <button class="btn-edit leg-remove" type="button">移除這段</button>
  </div>
  <div class="dialog__row">
    ${input("number", "航班號碼", 'maxlength="30" placeholder="航班號碼" autocapitalize="characters"')}
    ${input("airline", "航空公司", 'maxlength="50" placeholder="航空公司"')}
  </div>
  ${input("aircraft", "機型", 'maxlength="50" placeholder="機型"')}
  <p class="field__hint leg-lookup" hidden></p>
  <span class="leg__label">出發</span>
  <div class="dialog__row">
    ${input("from-code", "出發機場代碼", 'maxlength="4" placeholder="轉機機場代碼" autocapitalize="characters"')}
    ${input("from-city", "出發城市", 'maxlength="50" placeholder="城市"')}
    ${input("from-time", "出發時間", 'type="time"')}
    ${input("from-terminal", "出發航廈", 'maxlength="50" placeholder="航廈"')}
  </div>
  <span class="leg__label">抵達</span>
  <div class="dialog__row">
    ${input("to-code", "抵達機場代碼", 'maxlength="4" placeholder="機場代碼" autocapitalize="characters"')}
    ${input("to-city", "抵達城市", 'maxlength="50" placeholder="城市"')}
    ${input("to-time", "抵達時間", 'type="time"')}
    ${input("to-terminal", "抵達航廈", 'maxlength="50" placeholder="航廈"')}
  </div>
  ${input("duration", "飛行時間", 'maxlength="20" placeholder="飛行時間，例如：1h 50m"')}
</li>`
    );
    const all = this.segments();
    const leg = all[all.length - 1];
    const prev = all[all.length - 2];

    if (moveDestination) {
      const [, destination] = this.endpoints();
      const prevTo = prev.get("to-code").value.trim().toUpperCase();
      if (!prevTo || prevTo === destination.code) {
        /* 前一段還是飛到目的地：目的地搬到新的一段，前一段的抵達留白讓使用者填轉機機場 */
        for (const side of ["code", "city", "time", "terminal"]) {
          leg.get(`to-${side}`).value = prev.get(`to-${side}`).value;
          prev.get(`to-${side}`).value = "";
          delete prev.get(`to-${side}`).dataset.touched;
        }
      } else {
        /* 前一段已經填了轉機機場（例如查詢帶入的 HKG）：新的一段從那裡出發，飛到目的地 */
        leg.get("from-code").value = prev.get("to-code").value;
        leg.get("from-city").value = prev.get("to-city").value;
        leg.get("to-code").value = destination.code;
        leg.get("to-city").value = destination.city;
      }
    } else {
      this.fillSegment(leg, data);
      for (const name of this.SEGMENT_FIELDS) if (leg.get(name).value) leg.get(name).dataset.touched = "1";
    }
    this.refreshLegs();
    return leg;
  },

  /* 移除一段：如果是最後一段，它的抵達（目的地）還給前一段 */
  removeLeg(li) {
    const all = this.segments();
    const index = all.findIndex((seg) => seg.el === li);
    const seg = all[index];
    const prev = all[index - 1];
    if (index === all.length - 1 && prev) {
      for (const side of ["code", "city", "time", "terminal"]) {
        const value = seg.get(`to-${side}`).value;
        if (value) prev.get(`to-${side}`).value = value;
      }
    }
    clearTimeout(seg.state.timer);
    li.remove();
    this.refreshLegs();
  },

  refreshLegs() {
    [...this.f.legs.children].forEach((li, i) => {
      li.querySelector(".leg__title").textContent = `第 ${i + 2} 段`;
    });
    this.f["leg-add"].hidden = this.f.legs.children.length >= this.MAX_LEGS;
  },

  /* 兩段之間的轉機時間（抵達 → 下一段出發；跨午夜就加一天） */
  layover(arrive, depart) {
    const toMin = (t) => (/^\d{2}:\d{2}$/.test(t || "") ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null);
    const a = toMin(arrive);
    const d = toMin(depart);
    if (a === null || d === null) return "";
    const m = (d - a + 1440) % 1440;
    return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
  },

  /* ---------- 查詢真實航班 ---------- */

  lookupAvailable() {
    return Boolean(Trip.api.status.flightLookup);
  },

  flightDate() {
    const days = this.trip.days;
    return this.selectedType() === "去程" ? days[0].date : days[days.length - 1].date;
  },

  /* 打字停下來一下再查，避免每打一個字就查一次（每一段各自查） */
  scheduleLookup(seg, delay = 700) {
    clearTimeout(seg.state.timer);
    if (!this.lookupAvailable() || !this.dialog.open) return;
    const number = seg.get("number").value.replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(number)) {
      seg.hint("");
      return;
    }
    seg.state.timer = setTimeout(() => this.lookup(seg, number), delay);
  },

  /* 用航班號碼與航班日期查詢；nearest＝true 時查最近一班（使用者在提示裡選擇的） */
  async lookup(seg, number, { nearest = false } = {}) {
    const seq = ++seg.state.seq;
    const date = this.flightDate();
    seg.hint(nearest ? `查詢 ${number} 最近一班的資料…` : `查詢 ${number}（${date}）的航班資料…`);
    const from = seg.get("from-code").value.trim() || (seg.main && this.selectedType() === "去程" ? this.HOME.code : "");
    try {
      const { flight } = await Trip.api.request("POST", "flights/lookup", { number, date, nearest, from });
      if (seq !== seg.state.seq || !this.dialog.open || !seg.el.isConnected) return;
      if (!flight) {
        if (nearest) {
          seg.hint(`查不到 ${number} 這個航班，請確認航班號碼，或手動填寫`);
          return;
        }
        seg.hint(`${date} 查不到 ${number}`);
        this.showMissing(seg, number, date);
        return;
      }
      const filled = this.applyLookup(seg, flight);
      /* 最近一班的資料：起降時間可能和那天不同 */
      const note = flight.nearest
        ? `已帶入最近一班（${flight.date || "近期"}）的資料，起降時間可能和 ${date} 不同，請再確認。`
        : "";
      seg.hint(
        filled.length ? `${note}已自動帶入：${filled.join("、")}（可以再修改）` : `${note}查到航班，但沒有新的資料可以帶入`
      );
    } catch (err) {
      if (seq === seg.state.seq) seg.hint(err.message || "航班查詢失敗，請手動填寫");
    }
  },

  /* 那天查不到：跳出提示（疊在新增航班對話框上） */
  showMissing(seg, number, date) {
    const { formatDate } = Trip.utils;
    const d = formatDate(date);
    this.missingSeg = seg;
    this.missingNumber = number;
    this.missingText.textContent = `${number} 在 ${d.md}（${d.weekday}）查不到航班。`;
    this.missing.showModal();
    this.missingNearest.focus();
  },

  /* 把查到的資料填進還沒被使用者改過的欄位，回傳填了哪些 */
  applyLookup(seg, flight) {
    const filled = new Set();
    const fill = (name, value, label) => {
      const input = seg.get(name);
      if (!value || input.dataset.touched || input.value === value) return;
      input.value = value;
      filled.add(label);
    };
    /* 航空公司：已經依航班號碼帶入中文名稱就保留，空白才用查到的（英文）名稱 */
    if (!seg.get("airline").value.trim()) fill("airline", flight.airline, "航空公司");
    fill("aircraft", flight.aircraft, "機型");
    for (const side of ["from", "to"]) {
      const p = flight[side] || {};
      const code = seg.get(`${side}-code`);
      if (p.code && p.code !== code.value.trim().toUpperCase() && !code.dataset.touched) {
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

  /* 姓名：照機票、護照的寫法「姓, 名」（Liu, Darren、王, 小明）；只填一個就不加逗號 */
  fullName({ lastName = "", firstName = "" } = {}) {
    const last = String(lastName).trim();
    const first = String(firstName).trim();
    return last && first ? `${last}, ${first}` : last || first;
  },

  /* 舊資料只有完整姓名：放進「名字」，使用者之後可以再拆 */
  addPassenger({ name = "", lastName, firstName, seat = "", baggageKg = "", baggagePieces = "" } = {}) {
    const { esc } = Trip.utils;
    const n = this.f.passengers.children.length + 1;
    const last = lastName ?? "";
    const first = firstName ?? (lastName == null ? name : "");
    this.f.passengers.insertAdjacentHTML(
      "beforeend",
      `
<li class="passenger-row">
  <input class="passenger-last" maxlength="30" placeholder="姓氏" aria-label="第 ${n} 位旅客姓氏" autocomplete="off" value="${esc(last)}">
  <input class="passenger-first" maxlength="30" placeholder="名字" aria-label="第 ${n} 位旅客名字" autocomplete="off" value="${esc(first)}">
  <button class="passenger-remove" type="button" aria-label="移除這位旅客">✕</button>
  <div class="passenger-bag">
    <input class="passenger-seat" maxlength="10" placeholder="座位" aria-label="第 ${n} 位旅客座位" autocapitalize="characters" autocomplete="off" value="${esc(seat)}">
    <span aria-hidden="true">🧳</span>
    <input class="passenger-kg" maxlength="20" inputmode="decimal" autocomplete="off" placeholder="23" aria-label="第 ${n} 位旅客託運行李每件公斤數" value="${esc(baggageKg)}">
    <span>kg ×</span>
    <input class="passenger-pieces" type="number" inputmode="numeric" min="0" max="20" step="1" placeholder="1" aria-label="第 ${n} 位旅客託運行李件數" value="${esc(baggagePieces)}">
    <span>件</span>
  </div>
</li>`
    );
    this.refreshPassengerAdd();
  },

  refreshPassengerAdd() {
    this.f["passenger-add"].hidden = this.f.passengers.children.length >= this.MAX_PASSENGERS;
  },

  /* 姓名、座位、行李都空白的列不存 */
  collectPassengers() {
    const num = (input, max, round) => {
      const v = input.value.trim();
      const n = Number(v);
      if (v === "" || !Number.isFinite(n)) return "";
      const clamped = Math.min(Math.max(n, 0), max);
      return round ? Math.round(clamped) : clamped;
    };
    return [...this.f.passengers.children]
      .map((li) => {
        const lastName = li.querySelector(".passenger-last").value.trim();
        const firstName = li.querySelector(".passenger-first").value.trim();
        return {
        lastName,
        firstName,
        /* name：組好的完整姓名（卡片、分享、Notion 都用這個） */
        name: this.fullName({ lastName, firstName }),
        seat: li.querySelector(".passenger-seat").value.trim().toUpperCase(),
        /* 公斤數照輸入的文字存（不限只能填數字） */
        baggageKg: li.querySelector(".passenger-kg").value.trim().slice(0, 20),
        baggagePieces: num(li.querySelector(".passenger-pieces"), 20, true),
        };
      })
      .filter((p) => p.name || p.seat || p.baggageKg !== "" || p.baggagePieces !== "");
  },

  async save() {
    const flight = this.collect();
    if (!flight.number) {
      this.message("請填寫航班號碼", "error");
      this.f.number.focus();
      return;
    }
    const legs = this.legSegments();
    const missing = legs.findIndex((seg) => {
      const leg = this.segmentData(seg);
      return !this.isEmptyLeg(leg) && !leg.number;
    });
    if (missing >= 0) {
      this.message(`請填寫第 ${missing + 2} 段的航班號碼`, "error");
      legs[missing].get("number").focus();
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
    this.message("儲存中…", "pending");
    try {
      await action();
    } catch (err) {
      this.setSaving(false);
      this.message(err.message, "error");
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
    Trip.api.renderMessage(this.f.msg, text, type);
  },
};
