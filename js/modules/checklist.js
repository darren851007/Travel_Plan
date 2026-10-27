/* ============================================================
   準備清單：可打勾，狀態依地點分開存在這台裝置的瀏覽器（localStorage）
   ============================================================ */
window.Trip = window.Trip || {};

Trip.checklist = {
  STORAGE_PREFIX: "trip-checklist:",

  init() {
    this.list = document.getElementById("checklist");
    this.bar = document.getElementById("checklist-bar");
    this.count = document.getElementById("checklist-count");
    this.addBar = document.getElementById("checklist-add-bar");
    if (!this.list) return;

    /* 可以編輯的行程：「＋ 新增項目」、每個項目的「編輯」（存檔走 js/core/editor.js） */
    document.getElementById("checklist-add")?.addEventListener("click", () => this.openEdit());
    this.list.addEventListener("click", (e) => {
      const button = e.target.closest("[data-edit-check]");
      if (button) this.openEdit(button.dataset.editCheck);
    });

    this.list.addEventListener("change", (e) => {
      const input = e.target;
      if (input.type !== "checkbox") return;
      if (input.checked) this.done.add(input.value);
      else this.done.delete(input.value);
      this.save();
      this.updateProgress();
    });
  },

  editable() {
    const dest = Trip.state.destination;
    return Trip.editor.canEdit(dest) && !Trip.editor.needsResync(dest);
  },

  openEdit(id) {
    const dest = Trip.state.destination;
    const item = id ? (dest.checklist || []).find((c) => c.id === id) : null;
    const run = (op, values, mutate) =>
      Trip.editor.run(dest, { table: "checklist", op, uid: id, values, mutate });

    Trip.editDialog.open({
      title: item ? "編輯準備項目" : "新增準備項目",
      submitLabel: item ? "儲存" : "新增",
      fields: [
        { name: "text", label: "項目", required: true, placeholder: "例如：護照" },
        { name: "hint", label: "說明", placeholder: "例如：效期 6 個月以上", max: 500 },
      ],
      values: item || {},
      onSubmit: async (values) => {
        await run(item ? "update" : "create", values, (d, newId, row) => Trip.mutate.setChecklist(d, newId, row));
        Trip.editor.rerender();
        Trip.addItem.toast(item ? `已更新「${values.text}」` : `已新增「${values.text}」`);
      },
      onDelete: item
        ? async () => {
            await run("delete", null, (d, oldId) => Trip.mutate.removeChecklist(d, oldId));
            Trip.editor.rerender();
            Trip.addItem.toast(`已刪除「${item.text}」`);
          }
        : null,
    });
  },

  render(trip) {
    if (!this.list) return;
    const editable = this.editable();
    if (this.addBar) this.addBar.hidden = !editable;
    this.items = trip.checklist;
    this.storageKey = this.STORAGE_PREFIX + trip.id;
    this.done = this.load();

    const { esc } = Trip.utils;
    this.list.innerHTML = this.items
      .map(
        (item) => `
<li class="check-item">
  <label>
    <input type="checkbox" value="${esc(item.id)}" ${this.done.has(item.id) ? "checked" : ""}>
    <span class="check-item__text">
      ${esc(item.text)}
      ${item.hint ? `<span class="check-item__hint">${esc(item.hint)}</span>` : ""}
    </span>
  </label>
  ${editable ? `<button class="btn-edit check-item__edit" type="button" data-edit-check="${esc(item.id)}" aria-label="編輯「${esc(item.text)}」">編輯</button>` : ""}
</li>`
      )
      .join("");
    this.updateProgress();
  },

  load() {
    try {
      return new Set(JSON.parse(localStorage.getItem(this.storageKey)) || []);
    } catch {
      return new Set();
    }
  },

  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify([...this.done]));
    } catch {
      /* 無痕模式等情況存不了，就只在本次瀏覽有效 */
    }
  },

  updateProgress() {
    const total = this.items.length;
    const done = this.items.filter((item) => this.done.has(item.id)).length;
    if (this.count) this.count.textContent = `${done} / ${total}`;
    if (this.bar) {
      this.bar.style.width = `${(done / total) * 100}%`;
      this.bar.parentElement.setAttribute("aria-valuenow", String(done));
      this.bar.parentElement.setAttribute("aria-valuemax", String(total));
    }
  },
};
