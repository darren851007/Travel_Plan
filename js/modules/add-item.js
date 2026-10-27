/* ============================================================
   新增景點對話框：在某一天加一筆行程，直接存進使用者自己的 Notion「行程」表
   只有登入 Notion、而且正在看自己同步的行程時才能新增
   ============================================================ */
window.Trip = window.Trip || {};

Trip.addItem = {
  init() {
    const $ = (id) => document.getElementById(id);
    this.bar = $("add-item-bar");
    this.openButton = $("add-item-open");
    this.hint = $("add-item-hint");
    this.dialog = $("add-item-dialog");
    this.form = $("add-item-form");
    if (!this.bar || !this.dialog || !this.form) return;

    this.fields = {
      day: $("add-item-day"),
      time: $("add-item-time"),
      city: $("add-item-city"),
      cities: $("add-item-cities"),
      title: $("add-item-name"),
      themeField: $("add-item-theme-field"),
      theme: $("add-item-theme"),
      transport: $("add-item-transport"),
      must: $("add-item-must"),
      note: $("add-item-note"),
      msg: $("add-item-msg"),
      submit: $("add-item-submit"),
    };

    this.openButton.addEventListener("click", () => this.open());
    $("add-item-cancel").addEventListener("click", () => this.dialog.close());
    this.fields.day.addEventListener("change", () => this.applyDayDefaults());
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

  /* 依登入狀態與資料來源，顯示「新增景點」按鈕或提示 */
  refresh() {
    if (!this.bar) return;
    const status = Trip.notionPanel?.status;
    if (!status?.configured) {
      this.bar.hidden = true;
      return;
    }
    const dest = Trip.state.destination;
    const canAdd = Boolean(status.loggedIn && dest?.notionPageId);
    this.bar.hidden = false;
    this.openButton.hidden = !canAdd;
    this.hint.textContent = canAdd
      ? ""
      : status.loggedIn
        ? "到「選擇行程」頁按「從 Notion 同步」後，就能在這裡新增景點"
        : "用 Notion 登入並同步你的行程後，就能在這裡新增景點";
  },

  /* ---------- 對話框 ---------- */

  open() {
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
    const current = days[Trip.itinerary.current || 0];
    f.day.value = String(current?.number || (Trip.itinerary.current || 0) + 1);

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

    f.time.value = "";
    f.title.value = "";
    f.theme.value = "";
    f.note.value = "";
    f.must.checked = false;
    this.message("");
    this.setSaving(false);
    this.applyDayDefaults();

    this.dialog.showModal();
    f.title.focus();
  },

  /* 換天時：城市預設為那天的城市；那天還沒有主題（或是新的一天）才顯示主題欄 */
  applyDayDefaults() {
    const f = this.fields;
    const number = Number(f.day.value);
    const days = this.trip.days;
    const day = days.find((d, i) => (d.number || i + 1) === number);
    f.city.value = day?.city || days[days.length - 1]?.city || "";
    f.themeField.hidden = Boolean(day?.theme);
  },

  collect() {
    const f = this.fields;
    return {
      day: Number(f.day.value),
      time: f.time.value,
      city: f.city.value.trim(),
      title: f.title.value.trim(),
      theme: f.themeField.hidden ? "" : f.theme.value.trim(),
      transport: [...f.transport.querySelectorAll("input:checked")].map((el) => el.value),
      must: f.must.checked,
      note: f.note.value.trim(),
    };
  },

  async save() {
    const item = this.collect();
    if (!item.title) {
      this.message("請填寫行程名稱", "error");
      this.fields.title.focus();
      return;
    }

    const dest = Trip.state.destination;
    this.setSaving(true);
    this.message("儲存到 Notion…", "pending");
    try {
      const result = await Trip.notionPanel.request("POST", "notion/add-item", {
        pageId: dest.notionPageId,
        item,
        config: Trip.notionCache.config(),
      });
      const dayIndex = this.applyToTrip(dest.id, result.item);
      this.dialog.close();
      Trip.state.select(dest.id, false);
      Trip.itinerary.select(dayIndex, true);
      document.getElementById("itinerary")?.scrollIntoView({ behavior: Trip.utils.prefersReducedMotion() ? "auto" : "smooth" });
      this.toast(`已新增「${result.item.title}」`);
    } catch (err) {
      this.setSaving(false);
      this.message(err.status === 401 ? "Notion 登入已過期，請到「選擇行程」頁重新登入" : err.message, "error");
    }
  },

  /* 新增成功後，同步更新畫面上的資料與瀏覽器快取（不用重新同步整個 Notion） */
  applyToTrip(destId, item) {
    const insert = (dest) => {
      let index = dest.days.findIndex((d, i) => (d.number || i + 1) === item.day);
      if (index < 0) {
        dest.days.push({ number: item.day, city: item.city, theme: item.theme, items: [] });
        dest.days.sort((a, b) => (a.number || 0) - (b.number || 0));
        index = dest.days.findIndex((d) => d.number === item.day);
      }
      const day = dest.days[index];
      if (!day.city && item.city) day.city = item.city;
      if (!day.theme && item.theme) day.theme = item.theme;
      day.items.push({ time: item.time, title: item.title, note: item.note, transport: item.transport, must: item.must });
      day.items.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
      return index;
    };

    const live = Trip.destinations.find((d) => d.id === destId);
    const index = insert(live);

    const cache = Trip.notionCache.load();
    const cached = cache?.destinations?.find((d) => d.id === destId);
    if (cached) {
      insert(cached);
      Trip.notionCache.save(cache);
    }
    return index;
  },

  setSaving(saving) {
    this.saving = saving;
    this.fields.submit.disabled = saving;
    this.fields.submit.textContent = saving ? "儲存中…" : "新增到 Notion";
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
