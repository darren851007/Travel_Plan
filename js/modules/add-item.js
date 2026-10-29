/* ============================================================
   景點對話框：新增、編輯、刪除某一天的行程；「編輯這一天」改主題與城市
   - 自己在這台裝置建立的行程：存在這台裝置
   - 共編行程：存到共編房間（存檔都走 js/core/editor.js）
   每個景點可以放一張照片（js/core/photos.js），顯示在時間軸上
   餐廳也用同一個對話框（kind: "food"）：多了餐別（早餐、午餐…），和景點一起依時間排序
   出發地點、到達地點（from、to），中間可以加「中途停靠」（stops：名稱、抵達時間、停留分鐘）
   ============================================================ */
window.Trip = window.Trip || {};

Trip.addItem = {
  init() {
    const $ = (id) => document.getElementById(id);
    this.bar = $("add-item-bar");
    this.hint = $("add-item-hint");
    this.dialog = $("add-item-dialog");
    this.form = $("add-item-form");
    if (!this.bar || !this.dialog || !this.form) return;

    this.fields = {
      heading: $("add-item-title"),
      day: $("add-item-day"),
      from: $("add-item-from"),
      to: $("add-item-to"),
      stops: $("add-item-stops"),
      stopAdd: $("add-item-stop-add"),
      time: $("add-item-time"),
      end: $("add-item-end"),
      duration: $("add-item-duration"),
      endCalc: $("add-item-end-calc"),
      city: $("add-item-city"),
      cities: $("add-item-cities"),
      title: $("add-item-name"),
      themeField: $("add-item-theme-field"),
      theme: $("add-item-theme"),
      transport: $("add-item-transport"),
      must: $("add-item-must"),
      note: $("add-item-note"),
      map: $("add-item-map"),
      msg: $("add-item-msg"),
      submit: $("add-item-submit"),
      remove: $("add-item-delete"),
      photo: $("add-item-photo"),
      photoLabel: $("add-item-photo-label"),
      nameLabel: $("add-item-name-label"),
      mealField: $("add-item-meal-field"),
      meal: $("add-item-meal"),
      mustLabel: $("add-item-must-label"),
    };

    /* 選了餐別、還沒填時間：帶入這個餐別常見的時間與停留時間 */
    this.fields.meal.addEventListener("change", (e) => {
      const meal = Trip.config.meals.find((m) => m.label === e.target.value);
      if (!meal) return;
      if (!this.fields.time.value) this.fields.time.value = meal.time;
      if (!this.fields.duration.value) this.setDuration(meal.minutes);
      this.syncTimes();
    });

    /* 出發、抵達、停留任何一個改了，就重算結束時間（抵達＋停留） */
    for (const name of ["time", "end", "duration"]) {
      this.fields[name].addEventListener("change", () => this.syncTimes());
      this.fields[name].addEventListener("input", () => this.syncTimes());
    }
    /* 中途停靠：新增、移除；改了抵達或停留就重算離開時間 */
    this.fields.stopAdd.addEventListener("click", () => {
      this.addStop().querySelector('[data-field="name"]').focus();
    });
    this.fields.stops.addEventListener("click", (e) => {
      const button = e.target.closest(".leg-remove");
      if (!button) return;
      button.closest(".leg").remove();
      this.renumberStops();
    });
    for (const type of ["input", "change"]) {
      this.fields.stops.addEventListener(type, (e) => {
        const li = e.target.closest(".leg");
        if (li) this.syncStop(li);
      });
    }
    $("add-item-cancel").addEventListener("click", () => this.dialog.close());
    this.fields.day.addEventListener("change", () => this.applyDayDefaults());
    this.fields.remove.addEventListener("click", () => this.confirmDelete());
    /* 開始輸入名稱就清掉「請填寫行程名稱」的提示 */
    this.fields.title.addEventListener("input", () => {
      if (!this.saving) this.message("");
    });
    this.form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.save();
    });
    /* 點對話框外面（背景）就關閉 */
    this.dialog.addEventListener("click", (e) => {
      if (e.target === this.dialog && !this.saving) this.dialog.close();
    });
  },

  render(trip) {
    this.trip = trip;
    this.refresh();
  },

  editable() {
    const dest = Trip.state.destination;
    return Trip.editor.canEdit(dest);
  },

  /* 依資料來源，顯示「新增景點」按鈕或提示 */
  refresh() {
    if (!this.bar) return;
    const dest = Trip.state.destination;
    const canAdd = this.editable();
    const hint = canAdd
      ? ""
      : dest?.shared
        ? "這是好友分享的行程；按上方「加入我的行程」後就能編輯"
        : dest?.room
          ? "連上共編後就能編輯"
          : "";
    this.bar.hidden = false;
    this.hint.textContent = hint;
  },

  /* ---------- 對話框 ---------- */

  /* 新增：預設在目前選的那一天；kind：spot（景點）或 food（餐廳） */
  open(kind = "spot") {
    this.editing = null;
    this.kind = kind;
    this.prepare();
    const days = this.trip.days;
    const current = days[Trip.itinerary.current || 0];
    this.fields.day.value = String(current?.number || (Trip.itinerary.current || 0) + 1);
    this.applyDayDefaults();
    this.preparePhoto(null);
    this.show(this.kind === "food" ? "新增餐廳" : "新增景點", "新增");
  },

  /* 照片欄位：共編行程大家都看得到，其他存在這台裝置 */
  preparePhoto(url) {
    const dest = Trip.state.destination;
    this.fields.photoLabel.textContent = dest.room ? "照片（選填，一起編輯的人都看得到）" : "照片（選填，存在這台裝置）";
    this.photo = Trip.photos.field(this.fields.photo, url, "景點照片預覽");
  },

  /* 編輯：帶入這個景點的資料 */
  async openEdit(uid) {
    const dest = Trip.state.destination;
    const at = Trip.mutate.findItem(dest, uid);
    if (!at) return;
    const day = dest.days[at.d];
    const item = day.items[at.i];
    this.editing = { uid, dayIndex: at.d };
    this.kind = item.kind === "food" ? "food" : "spot";
    this.prepare();

    const f = this.fields;
    f.day.value = String(day.number || at.d + 1);
    f.from.value = item.from || "";
    f.to.value = item.to || "";
    (item.stops || []).forEach((stop) => this.addStop(stop));
    f.time.value = item.time || "";
    /* 抵達時間；舊資料沒有抵達時間（當時的「結束時間」是出發＋停留），停留時間從那裡算回來 */
    f.end.value = item.arriveTime || "";
    this.setDuration(item.duration || (item.arriveTime ? "" : Trip.utils.minutesBetween(item.time, item.endTime)) || "");
    this.syncTimes();
    f.city.value = day.city || "";
    f.title.value = item.title || "";
    f.note.value = item.note || "";
    f.map.value = item.map || "";
    f.must.checked = Boolean(item.must);
    const meal = f.meal.querySelector(`input[value="${CSS.escape(item.meal || "")}"]`);
    if (meal) meal.checked = true;
    for (const box of f.transport.querySelectorAll("input")) box.checked = (item.transport || []).includes(box.value);
    f.themeField.hidden = true;
    this.preparePhoto(await Trip.photos.url(dest, uid));
    this.show(this.kind === "food" ? "編輯餐廳" : "編輯景點", "儲存");
  },

  /* 清空表單、產生日期與交通選項 */
  prepare() {
    const { esc, formatDate } = Trip.utils;
    const days = this.trip.days;
    const f = this.fields;

    /* 第幾天：現有的每一天 + 新的一天 */
    const lastNumber = days.reduce((max, d, i) => Math.max(max, d.number || i + 1), 0);
    f.day.innerHTML =
      days
        .map((d, i) => {
          const date = formatDate(d.date);
          return `<option value="${d.number || i + 1}">Day ${i + 1} · ${date.md}（${date.weekday}）${d.city ? ` · ${esc(d.city)}` : ""}</option>`;
        })
        .join("") + `<option value="${lastNumber + 1}">新的一天（Day ${days.length + 1}）</option>`;

    f.cities.innerHTML = this.trip.cities.map((c) => `<option value="${esc(c)}"></option>`).join("");

    f.transport.innerHTML = Object.entries(this.trip.transports)
      .map(
        ([key, t]) => `
<label class="chip">
  <input type="checkbox" name="transport" value="${esc(key)}">
  <span class="pill tone-${esc(t.tone)}">${esc(t.label)}</span>
</label>`
      )
      .join("");

    /* 景點／餐廳：名稱提示、餐別、必去或必吃 */
    const food = this.kind === "food";
    f.nameLabel.textContent = food ? "餐廳名稱" : "名稱";
    f.title.placeholder = food ? "例如：明洞餃子" : "例如：昌德宮";
    f.mealField.hidden = !food;
    f.mustLabel.textContent = food ? "★ 必吃" : "★ 必去";
    f.meal.innerHTML = Trip.config.meals
      .map(
        (m) => `
<label class="chip">
  <input type="radio" name="meal" value="${esc(m.label)}">
  <span class="pill tone-${esc(m.tone)}">${esc(m.label)}</span>
</label>`
      )
      .join("");

    f.from.value = "";
    f.to.value = "";
    f.stops.innerHTML = "";
    f.time.value = "";
    f.end.value = "";
    this.setDuration("");
    this.syncTimes();
    f.title.value = "";
    f.theme.value = "";
    f.note.value = "";
    f.map.value = "";
    f.must.checked = false;
  },

  show(heading, submitLabel) {
    const f = this.fields;
    f.heading.textContent = heading;
    this.submitLabel = submitLabel;
    f.remove.hidden = !this.editing;
    Trip.tripDelete.reset(f.remove, "刪除");
    this.message("");
    this.setSaving(false);
    this.dialog.showModal();
    f.title.focus();
  },

  /* ---------- 開始、結束、停留 ---------- */

  DURATIONS: [15, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360, 480],

  /* 停留時間選單：常用的選項；算出來不在清單裡的（例如 1 小時 10 分）另外加一個 */
  setDuration(minutes) {
    this.fields.duration.innerHTML = this.durationOptions(this.DURATIONS, minutes);
    this.fields.duration.value = minutes ? String(minutes) : "";
  },

  durationOptions(durations, minutes) {
    const { formatMinutes } = Trip.utils;
    const list = [...durations];
    if (minutes && !list.includes(minutes)) list.push(minutes);
    list.sort((a, b) => a - b);
    return `<option value="">不指定</option>` + list.map((m) => `<option value="${m}">${formatMinutes(m)}</option>`).join("");
  },

  /* ---------- 中途停靠 ---------- */

  /* 停靠站的停留通常比較短，多了 5、10 分 */
  STOP_DURATIONS: [5, 10, 15, 20, 30, 45, 60, 90, 120, 180],

  /* 加一個停靠站（每站一張小卡，樣式跟轉機航班一樣） */
  addStop(stop = {}) {
    const { esc } = Trip.utils;
    this.fields.stops.insertAdjacentHTML(
      "beforeend",
      `
<li class="leg">
  <div class="leg__head">
    <strong class="leg__title"></strong>
    <button class="btn-edit leg-remove" type="button">移除這站</button>
  </div>
  <input data-field="name" aria-label="停靠站名稱" maxlength="100" autocomplete="off" placeholder="停靠站名稱，例如：首爾站" value="${esc(stop.name || "")}">
  <div class="dialog__row">
    <label class="field">
      <span class="leg__label">抵達時間</span>
      <input data-field="arrive" type="time" step="300" value="${esc(stop.arrive || "")}">
    </label>
    <label class="field">
      <span class="leg__label">停留時間</span>
      <select data-field="minutes">${this.durationOptions(this.STOP_DURATIONS, stop.minutes)}</select>
    </label>
  </div>
  <span class="time-calc" data-field="calc" hidden></span>
</li>`
    );
    const li = this.fields.stops.lastElementChild;
    li.querySelector('[data-field="minutes"]').value = stop.minutes ? String(stop.minutes) : "";
    this.renumberStops();
    this.syncStop(li);
    return li;
  },

  renumberStops() {
    [...this.fields.stops.children].forEach((li, i) => {
      li.querySelector(".leg__title").textContent = `停靠站 ${i + 1}`;
    });
  },

  /* 停靠站的離開時間＝抵達＋停留 */
  syncStop(li) {
    const stop = this.stopData(li);
    const leave = stop.arrive && stop.minutes ? Trip.utils.addMinutes(stop.arrive, stop.minutes) : "";
    const calc = li.querySelector('[data-field="calc"]');
    calc.hidden = !leave;
    calc.textContent = leave ? `離開時間：${leave}` : "";
  },

  stopData(li) {
    const get = (name) => li.querySelector(`[data-field="${name}"]`).value;
    return { name: get("name").trim(), arrive: get("arrive"), minutes: Number(get("minutes")) || "" };
  },

  /* 完全沒填的停靠站不存 */
  collectStops() {
    return [...this.fields.stops.children].map((li) => this.stopData(li)).filter((s) => s.name || s.arrive || s.minutes);
  },

  /* 結束時間＝抵達（沒填就用出發）＋停留 */
  endTimeOf({ time, arriveTime, duration }) {
    const base = arriveTime || time;
    return base && duration ? Trip.utils.addMinutes(base, duration) : "";
  },

  /* 對話框裡顯示算好的結束時間 */
  syncTimes() {
    const { formatMinutes } = Trip.utils;
    const f = this.fields;
    const minutes = Number(f.duration.value) || 0;
    const end = this.endTimeOf({ time: f.time.value, arriveTime: f.end.value, duration: minutes });
    f.endCalc.hidden = !end;
    f.endCalc.textContent = end
      ? `結束時間：${end}（${f.end.value ? `抵達 ${f.end.value}` : `出發 ${f.time.value}`} ＋ 停留 ${formatMinutes(minutes)}）`
      : "";
  },

  /* 換天時：城市預設為那天的城市；那天還沒有主題（或是新的一天）才顯示主題欄 */
  applyDayDefaults() {
    const f = this.fields;
    const number = Number(f.day.value);
    const days = this.trip.days;
    const day = days.find((d, i) => (d.number || i + 1) === number);
    if (!this.editing) f.city.value = day?.city || days[days.length - 1]?.city || "";
    f.themeField.hidden = Boolean(day?.theme) || Boolean(this.editing);
  },

  collect() {
    const f = this.fields;
    const item = {
      day: Number(f.day.value),
      from: f.from.value.trim(),
      to: f.to.value.trim(),
      stops: this.collectStops(),
      time: f.time.value,
      arriveTime: f.end.value,
      duration: Number(f.duration.value) || "",
      /* 結束時間是算出來的（抵達＋停留），一起存著方便顯示與匯出 */
      endTime: this.endTimeOf({ time: f.time.value, arriveTime: f.end.value, duration: Number(f.duration.value) || 0 }),
      city: f.city.value.trim(),
      title: f.title.value.trim(),
      transport: [...f.transport.querySelectorAll("input:checked")].map((el) => el.value),
      must: f.must.checked,
      note: f.note.value.trim(),
      map: f.map.value.trim(),
      kind: this.kind === "food" ? "food" : "spot",
      meal: this.kind === "food" ? f.meal.querySelector("input:checked")?.value || "" : "",
    };
    /* 主題只在新的一天（或那天還沒有主題）時送出，編輯景點不會動到當天主題 */
    if (!f.themeField.hidden) item.theme = f.theme.value.trim();
    return item;
  },

  async save() {
    const item = this.collect();
    if (!item.title) {
      this.message(item.kind === "food" ? "請填寫餐廳名稱" : "請填寫行程名稱", "error");
      this.fields.title.focus();
      return;
    }
    if (item.arriveTime && !item.time) {
      this.message("填了抵達時間，也要填出發時間", "error");
      this.fields.time.focus();
      return;
    }
    if (item.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time)) {
      this.message("時間格式請用 09:30", "error");
      return;
    }
    const unnamed = item.stops.findIndex((s) => !s.name);
    if (unnamed >= 0) {
      this.message(`請填寫停靠站 ${unnamed + 1} 的名稱`, "error");
      this.fields.stops.children[unnamed]?.querySelector('[data-field="name"]').focus();
      return;
    }

    const photo = this.photo.state();
    if (photo.busy) {
      this.message("照片還在處理中，請稍等一下", "pending");
      return;
    }

    const dest = Trip.state.destination;
    let dayIndex = 0;
    const editing = this.editing;
    await this.run(async () => {
      const { id } = await Trip.editor.run(dest, {
        table: "itinerary",
        op: editing ? "update" : "create",
        uid: editing?.uid,
        values: item,
        mutate: (d, id, row) => {
          dayIndex = editing ? Trip.mutate.updateItem(d, id, row) : Trip.mutate.addItem(d, id, row);
        },
      });

      /* 景點存好後再存照片；照片失敗不影響景點 */
      let note = "";
      if (photo.changed) {
        try {
          await Trip.photos.setPhoto(Trip.state.destination, id, photo.blob);
        } catch (err) {
          note = `（照片沒有存成功：${err.message}）`;
        }
      }
      this.finish(dayIndex, `${editing ? `已更新「${item.title}」` : `已新增「${item.title}」`}${note}`);
    });
  },

  async confirmDelete() {
    const f = this.fields;
    if (!Trip.tripDelete.confirm(f.remove, "刪除")) return;
    const dest = Trip.state.destination;
    const { uid, dayIndex } = this.editing;
    const title = f.title.value.trim();
    const photoRef = Trip.photos.photoOf(dest, uid);
    await this.run(async () => {
      await Trip.editor.run(dest, {
        table: "itinerary",
        op: "delete",
        uid,
        mutate: (d, id) => Trip.mutate.removeItem(d, id),
      });
      if (!dest.room) Trip.photos.dropItem(dest, uid, photoRef);
      this.finish(dayIndex, `已刪除「${title}」`);
    });
  },

  /* 「編輯這一天」：主題與城市 */
  /* 每天可以各自選國家與城市（可搜尋的選單，js/core/places.js）；
     舊行程的每一天沒有記國家，預設是整趟行程的國家 */
  async editDay(dayIndex) {
    const dest = Trip.state.destination;
    const day = dest.days[dayIndex];
    try {
      await Trip.places.ready();
    } catch (err) {
      this.toast(`讀不到國家與城市清單：${err.message}`);
      return;
    }
    const country = day.country
      ? { code: day.countryCode || "", name: day.country, flag: Trip.places.flagOf(day.countryCode) }
      : Trip.places.countryByName(dest.name);
    const city = day.city ? { name: day.city, place: dest.places?.[day.city] } : null;
    Trip.editDialog.open({
      title: `編輯 Day ${dayIndex + 1}`,
      fields: [
        { name: "theme", label: "當日主題", placeholder: "例如：古宮與韓屋" },
        {
          name: "country",
          type: "combo",
          label: "國家",
          placeholder: "搜尋國家，例如：日本",
          load: (q) => Trip.places.countryOptions(q),
          text: (c) => (c ? `${c.flag} ${c.name}`.trim() : ""),
          resets: ["city"],
          empty: "找不到這個國家",
        },
        {
          name: "city",
          type: "combo",
          label: "城市（選填）",
          placeholder: "搜尋城市，例如：京都",
          load: (q, values) => Trip.places.cityOptions(values.country, q),
          text: (c) => c?.name || "",
          empty: "找不到這個城市（請先選國家）",
          hint: "住宿日期與機場會依城市計算",
        },
      ],
      values: { theme: day.theme, country, city },
      onSubmit: async (values) => {
        await Trip.editor.editDay(dest, dayIndex, values);
        Trip.editor.rerender(dayIndex);
        this.toast(`已更新 Day ${dayIndex + 1}`);
      },
    });
  },

  /* 執行存檔：期間按鈕停用，失敗時顯示原因 */
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

  /* 完成：關閉對話框、重畫行程並跳到那一天 */
  finish(dayIndex, text) {
    this.dialog.close();
    Trip.editor.rerender(dayIndex);
    Trip.itinerary.select(Math.min(dayIndex, Trip.state.trip.days.length - 1), true);
    document.getElementById("itinerary")?.scrollIntoView({ behavior: Trip.utils.prefersReducedMotion() ? "auto" : "smooth" });
    this.toast(text);
  },

  setSaving(saving) {
    this.saving = saving;
    this.fields.submit.disabled = saving;
    this.fields.remove.disabled = saving;
    this.fields.submit.textContent = saving ? "儲存中…" : this.submitLabel || "新增";
  },

  message(text, type = "pending") {
    const box = this.fields.msg;
    box.className = text ? `notion__msg is-${type}` : "notion__msg";
    box.textContent = text;
  },

  toast(text) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    Trip.utils.replay(el);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 2800);
  },
};
