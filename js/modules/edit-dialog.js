/* ============================================================
   通用編輯對話框：依欄位設定產生表單（住宿、清單、旅程設定、編輯這一天）
   Trip.editDialog.open({ title, fields, values, submitLabel, onSubmit, onDelete })
   - fields：[{ name, label, type: text|date|time|textarea|photo, placeholder, required, options（建議清單）, half }]
     photo：照片欄位（js/core/photos.js），values 給目前照片網址；送出時的值是 { changed, blob }
   - onSubmit(values)：回傳 Promise；丟出錯誤會顯示在對話框裡
   - onDelete()：有給才顯示「刪除」（按兩次才刪）
   ============================================================ */
window.Trip = window.Trip || {};

Trip.editDialog = {
  init() {
    this.dialog = document.getElementById("edit-dialog");
    this.form = document.getElementById("edit-form");
    if (!this.dialog || !this.form) return;

    this.title = document.getElementById("edit-title");
    this.body = document.getElementById("edit-fields");
    this.msg = document.getElementById("edit-msg");
    this.submit = document.getElementById("edit-submit");
    this.remove = document.getElementById("edit-delete");

    document.getElementById("edit-cancel").addEventListener("click", () => this.dialog.close());
    this.form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.save();
    });
    this.remove.addEventListener("click", () => this.confirmDelete());
    this.dialog.addEventListener("cancel", (e) => {
      if (this.busy) e.preventDefault();
    });
    this.dialog.addEventListener("click", (e) => {
      if (e.target === this.dialog && !this.busy) this.dialog.close();
    });
  },

  open({ title, fields, values = {}, submitLabel = "儲存", onSubmit, onDelete }) {
    const { esc } = Trip.utils;
    this.options = { fields, onSubmit, onDelete, submitLabel };
    this.title.textContent = title;

    this.body.innerHTML = fields
      .map((f) => {
        const id = `edit-field-${f.name}`;
        if (f.type === "photo") {
          return `
<div class="field">
  <span class="field__label">${esc(f.label)}</span>
  <div id="${id}"></div>
</div>`;
        }
        const value = esc(values[f.name] ?? "");
        const common = `id="${id}" name="${esc(f.name)}" ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ""} ${f.required ? "required" : ""} autocomplete="off"`;
        const control =
          f.type === "textarea"
            ? `<textarea ${common} rows="2" maxlength="${f.max || 2000}">${value}</textarea>`
            : `<input ${common} type="${f.type || "text"}" value="${value}" maxlength="${f.max || 200}" ${f.options ? `list="${id}-list"` : ""}>
               ${f.options ? `<datalist id="${id}-list">${f.options.map((o) => `<option value="${esc(o)}"></option>`).join("")}</datalist>` : ""}`;
        return `
<label class="field${f.half ? " field--half" : ""}">
  <span class="field__label">${esc(f.label)}</span>
  ${control}
  ${f.hint ? `<span class="field__hint">${esc(f.hint)}</span>` : ""}
</label>`;
      })
      .join("");

    this.photos = Object.fromEntries(
      fields
        .filter((f) => f.type === "photo")
        .map((f) => [f.name, Trip.photos.field(document.getElementById(`edit-field-${f.name}`), values[f.name])])
    );

    this.remove.hidden = !onDelete;
    Trip.tripDelete.reset(this.remove, "刪除");
    this.message("");
    this.setBusy(false);
    this.dialog.showModal();
    this.body.querySelector("input, textarea")?.focus();
  },

  collect() {
    return Object.fromEntries(
      this.options.fields.map((f) =>
        [f.name, f.type === "photo" ? this.photos[f.name].state() : this.form.elements[f.name].value.trim()]
      )
    );
  },

  async save() {
    const values = this.collect();
    if (Object.values(this.photos).some((p) => p.state().busy)) {
      this.message("照片還在處理中，請稍等一下", "pending");
      return;
    }
    const missing = this.options.fields.find((f) => f.required && !values[f.name]);
    if (missing) {
      this.message(`請填寫${missing.label}`, "error");
      this.form.elements[missing.name].focus();
      return;
    }
    await this.run(() => this.options.onSubmit(values));
  },

  async confirmDelete() {
    if (!Trip.tripDelete.confirm(this.remove, "刪除")) return;
    await this.run(() => this.options.onDelete());
  },

  async run(action) {
    this.setBusy(true);
    this.message("儲存中…", "pending");
    try {
      await action();
      this.dialog.close();
    } catch (err) {
      this.setBusy(false);
      this.message(err.status === 401 ? "Notion 登入已過期，請到「選擇行程」頁重新登入" : err.message, "error");
    }
  },

  setBusy(busy) {
    this.busy = busy;
    this.submit.disabled = busy;
    this.remove.disabled = busy;
    this.submit.textContent = busy ? "儲存中…" : this.options?.submitLabel || "儲存";
  },

  message(text, type = "pending") {
    Trip.notionPanel.renderMessage(this.msg, text, type);
  },
};
