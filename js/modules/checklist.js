/* ============================================================
   準備清單：分成「待辦事項」和「行李準備」兩張卡片，可打勾
   打勾狀態依行程分開存在這台裝置的瀏覽器（localStorage）
   ============================================================ */
window.Trip = window.Trip || {};

Trip.checklist = {
  STORAGE_PREFIX: "trip-checklist:",

  init() {
    /* 每張卡片（待辦事項、行李準備）各自的清單、進度條、新增按鈕 */
    this.groups = [...document.querySelectorAll("[data-check-group]")].map((card) => ({
      key: card.dataset.checkGroup,
      card,
      list: card.querySelector("[data-check-list]"),
      bar: card.querySelector("[data-check-bar]"),
      count: card.querySelector("[data-check-count]"),
      addBar: card.querySelector("[data-check-add-bar]"),
    }));
    if (!this.groups.length) return;

    for (const group of this.groups) {
      /* 可以編輯的行程：「＋ 新增項目」（加到這張卡片）、每個項目的「編輯」（存檔走 js/core/editor.js） */
      group.card.querySelector("[data-check-add]")?.addEventListener("click", () => this.openEdit(null, group.key));
      group.list.addEventListener("click", (e) => {
        const button = e.target.closest("[data-edit-check]");
        if (button) this.openEdit(button.dataset.editCheck);
      });
      group.list.addEventListener("change", (e) => {
        const input = e.target;
        if (input.type !== "checkbox") return;
        if (input.checked) this.done.add(input.value);
        else this.done.delete(input.value);
        this.save();
        this.updateProgress();
      });
    }
  },

  editable() {
    const dest = Trip.state.destination;
    return Trip.editor.canEdit(dest);
  },

  /* 項目屬於哪張卡片：有寫 group 就用；舊資料看預設清單裡同 id 的項目；其他都是待辦事項 */
  groupOf(item) {
    if (item.group === "packing" || item.group === "todo") return item.group;
    const preset = [...Trip.config.checklistBefore, ...Trip.config.checklistAfter].find((c) => c.id === item.id);
    return preset?.group || "todo";
  },

  groupTitle(key) {
    return Trip.config.checklistGroups.find((g) => g.key === key)?.title || "待辦事項";
  },

  openEdit(id, groupKey) {
    const dest = Trip.state.destination;
    const item = id ? (dest.checklist || []).find((c) => c.id === id) : null;
    const group = item ? this.groupOf(item) : groupKey || "todo";
    const title = this.groupTitle(group);
    const run = (op, values, mutate) =>
      Trip.editor.run(dest, { table: "checklist", op, uid: id, values, mutate });

    Trip.editDialog.open({
      title: item ? "編輯準備項目" : `新增${title}`,
      submitLabel: item ? "儲存" : "新增",
      fields: [
        { name: "text", label: "項目", required: true, placeholder: group === "packing" ? "例如：充電器、轉接頭" : "例如：預約餐廳、買交通卡" },
        { name: "hint", label: "說明", placeholder: group === "packing" ? "例如：放隨身行李" : "例如：出發前一週訂好", max: 500 },
        /* 類別：改了存檔後會移到那張卡片 */
        {
          name: "group",
          label: "類別",
          type: "choice",
          options: Trip.config.checklistGroups.map((g) => ({ value: g.key, label: `${g.icon} ${g.title}`, tone: g.key === "packing" ? "butter" : "sky" })),
        },
      ],
      values: { ...(item || {}), group },
      onSubmit: async (values) => {
        const next = values.group === "packing" ? "packing" : "todo";
        await run(item ? "update" : "create", { ...values, group: next }, (d, newId, row) => Trip.mutate.setChecklist(d, newId, row));
        Trip.editor.rerender();
        const moved = item && next !== group;
        Trip.addItem.toast(
          moved ? `已把「${values.text}」移到「${this.groupTitle(next)}」` : item ? `已更新「${values.text}」` : `已新增「${values.text}」到「${this.groupTitle(next)}」`
        );
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
    if (!this.groups?.length) return;
    const editable = this.editable();
    this.items = trip.checklist;
    this.storageKey = this.STORAGE_PREFIX + trip.id;
    this.done = this.load();

    const { esc } = Trip.utils;
    for (const group of this.groups) {
      if (group.addBar) group.addBar.hidden = !editable;
      const items = this.items.filter((item) => this.groupOf(item) === group.key);
      group.list.innerHTML = items.length
        ? items
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
            .join("")
        : `<li class="check-empty">${editable ? "還沒有項目，按「＋ 新增項目」加入" : "沒有項目"}</li>`;
    }
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

  /* 每張卡片各自算進度 */
  updateProgress() {
    for (const group of this.groups) {
      const items = this.items.filter((item) => this.groupOf(item) === group.key);
      const total = items.length;
      const done = items.filter((item) => this.done.has(item.id)).length;
      if (group.count) group.count.textContent = `${done} / ${total}`;
      if (group.bar) {
        group.bar.style.width = total ? `${(done / total) * 100}%` : "0%";
        group.bar.parentElement.setAttribute("aria-valuenow", String(done));
        group.bar.parentElement.setAttribute("aria-valuemax", String(total));
      }
    }
  },
};
