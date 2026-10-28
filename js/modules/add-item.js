/* ============================================================
   景點對話框：新增、編輯、刪除某一天的行程；「編輯這一天」改主題與城市
   - 自己在這台裝置建立的行程：存在這台裝置
   - 共編行程：存到共編房間（存檔都走 js/core/editor.js）
   每個景點可以放一張照片（js/core/photos.js），顯示在時間軸上
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
      heading: $("add-item-title"),
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
      map: $("add-item-map"),
      msg: $("add-item-msg"),
      submit: $("add-item-submit"),
      remove: $("add-item-delete"),
      photo: $("add-item-photo"),
      photoLabel: $("add-item-photo-label"),
    };

    this.openButton.addEventListener("click", () => this.open());
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
    this.openButton.hidden = !canAdd;
    this.hint.textContent = hint;
  },

  /* ---------- 對話框 ---------- */

  /* 新增：預設在目前選的那一天 */
  open() {
    this.editing = null;
    this.prepare();
    const days = this.trip.days;
    const current = days[Trip.itinerary.current || 0];
    this.fields.day.value = String(current?.number || (Trip.itinerary.current || 0) + 1);
    this.applyDayDefaults();
    this.preparePhoto(null);
    this.show("新增景點", "新增");
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
    this.prepare();

    const f = this.fields;
    f.day.value = String(day.number || at.d + 1);
    f.time.value = item.time || "";
    f.city.value = day.city || "";
    f.title.value = item.title || "";
    f.note.value = item.note || "";
    f.map.value = item.map || "";
    f.must.checked = Boolean(item.must);
    for (const box of f.transport.querySelectorAll("input")) box.checked = (item.transport || []).includes(box.value);
    f.themeField.hidden = true;
    this.preparePhoto(await Trip.photos.url(dest, uid));
    this.show("編輯景點", "儲存");
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

    f.time.value = "";
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
      time: f.time.value,
      city: f.city.value.trim(),
      title: f.title.value.trim(),
      transport: [...f.transport.querySelectorAll("input:checked")].map((el) => el.value),
      must: f.must.checked,
      note: f.note.value.trim(),
      map: f.map.value.trim(),
    };
    /* 主題只在新的一天（或那天還沒有主題）時送出，編輯景點不會動到當天主題 */
    if (!f.themeField.hidden) item.theme = f.theme.value.trim();
    return item;
  },

  async save() {
    const item = this.collect();
    if (!item.title) {
      this.message("請填寫行程名稱", "error");
      this.fields.title.focus();
      return;
    }
    if (item.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time)) {
      this.message("時間格式請用 09:30", "error");
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
  editDay(dayIndex) {
    const dest = Trip.state.destination;
    const day = dest.days[dayIndex];
    Trip.editDialog.open({
      title: `編輯 Day ${dayIndex + 1}`,
      fields: [
        { name: "theme", label: "當日主題", placeholder: "例如：古宮與韓屋" },
        { name: "city", label: "城市", placeholder: "例如：首爾", options: this.trip.cities, hint: "住宿日期與機場會依城市計算" },
      ],
      values: { theme: day.theme, city: day.city },
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
