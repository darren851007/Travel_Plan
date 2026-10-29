/* ============================================================
   可搜尋的下拉選單（新增行程的國家、城市）
   點一下（或按下鍵）列出選項，打字即時篩選；上下鍵移動、Enter 選定、Esc 關閉；手機直接點
   Trip.combobox.create({ input, list, load, onSelect })
   - load(文字) 回傳選項陣列（可以是 Promise）：{ label, detail?, value }
     打字時等 200 毫秒才查，比較慢回來的舊結果會丟掉
   - onSelect(選項)：選定時呼叫；輸入框改顯示 label
   ============================================================ */
window.Trip = window.Trip || {};

Trip.combobox = {
  create(options) {
    const box = Object.create(this.proto);
    box.setup(options);
    return box;
  },

  proto: {
    setup({ input, list, load, onSelect, empty = "找不到符合的結果" }) {
      Object.assign(this, { input, list, load, onSelect, empty, items: [], active: -1, seq: 0, selected: "" });
      input.setAttribute("role", "combobox");
      input.setAttribute("aria-autocomplete", "list");
      input.setAttribute("aria-expanded", "false");
      input.setAttribute("aria-controls", list.id);
      input.autocomplete = "off";
      list.setAttribute("role", "listbox");
      list.hidden = true;

      /* 點一下：全選目前的文字，列出所有選項（還沒打字就不篩選）
         只有得到焦點（例如對話框打開時自動停在這裡）不會彈出清單 */
      input.addEventListener("focus", () => input.select());
      input.addEventListener("click", () => {
        if (this.list.hidden) this.search("");
      });
      input.addEventListener("input", () => {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.search(input.value.trim()), 200);
      });
      input.addEventListener("keydown", (e) => this.onKey(e));
      /* 離開：沒選新的就恢復原本選的文字 */
      input.addEventListener("blur", () => {
        setTimeout(() => {
          if (document.activeElement === input) return;
          this.close();
          input.value = this.selected;
        }, 150);
      });
      /* 點選項時不要讓輸入框失去焦點（否則清單會先關掉） */
      list.addEventListener("mousedown", (e) => e.preventDefault());
      list.addEventListener("click", (e) => {
        const li = e.target.closest("[data-index]");
        if (li) this.choose(Number(li.dataset.index));
      });
    },

    /* 由程式設定目前選的文字（例如換國家後預設的城市） */
    setText(text) {
      this.selected = text;
      this.input.value = text;
    },

    async search(text) {
      const seq = ++this.seq;
      this.open();
      if (!this.items.length) this.list.innerHTML = `<li class="combo__empty">讀取中…</li>`;
      let items;
      try {
        items = await this.load(text);
      } catch (err) {
        if (seq !== this.seq) return;
        this.items = [];
        this.list.innerHTML = `<li class="combo__empty">${Trip.utils.esc(err.message || "讀取失敗")}</li>`;
        return;
      }
      if (seq !== this.seq) return;
      this.items = items || [];
      this.active = this.items.length ? 0 : -1;
      this.render();
    },

    render() {
      const { esc } = Trip.utils;
      const id = this.list.id;
      this.list.innerHTML = this.items.length
        ? this.items
            .map(
              (item, i) => `
<li class="combo__option${i === this.active ? " is-active" : ""}" role="option" id="${id}-${i}" data-index="${i}" aria-selected="${i === this.active}">
  <span>${esc(item.label)}</span>${item.detail ? `<span class="combo__detail">${esc(item.detail)}</span>` : ""}
</li>`
            )
            .join("")
        : `<li class="combo__empty">${esc(this.empty)}</li>`;
      this.input.setAttribute("aria-activedescendant", this.active >= 0 ? `${id}-${this.active}` : "");
      this.list.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
    },

    onKey(e) {
      const open = !this.list.hidden;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!open) return this.search(this.input.value.trim());
        if (!this.items.length) return;
        const step = e.key === "ArrowDown" ? 1 : -1;
        this.active = (this.active + step + this.items.length) % this.items.length;
        this.render();
      } else if (e.key === "Enter") {
        /* 不要送出整個表單 */
        e.preventDefault();
        if (open && this.active >= 0) this.choose(this.active);
      } else if (e.key === "Escape" && open) {
        /* 只關清單，不關整個對話框 */
        e.preventDefault();
        e.stopPropagation();
        this.close();
        this.input.value = this.selected;
      }
    },

    choose(index) {
      const item = this.items[index];
      if (!item) return;
      this.close();
      this.onSelect(item);
    },

    open() {
      this.list.hidden = false;
      this.input.setAttribute("aria-expanded", "true");
    },

    close() {
      this.seq++;
      clearTimeout(this.timer);
      this.list.hidden = true;
      this.items = [];
      this.input.setAttribute("aria-expanded", "false");
      this.input.removeAttribute("aria-activedescendant");
    },
  },
};
