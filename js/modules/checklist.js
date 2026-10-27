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
    if (!this.list) return;

    this.list.addEventListener("change", (e) => {
      const input = e.target;
      if (input.type !== "checkbox") return;
      if (input.checked) this.done.add(input.value);
      else this.done.delete(input.value);
      this.save();
      this.updateProgress();
    });
  },

  render(trip) {
    if (!this.list) return;
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
