/* ============================================================
   行程首頁：依目前行程更新插圖、標題、日期與選單名稱
   可以刪除的行程顯示「刪除這趟行程」（邏輯在 js/modules/trip-delete.js）
   ============================================================ */
window.Trip = window.Trip || {};

Trip.hero = {
  init() {
    this.art = document.getElementById("hero-art");
    this.photo = document.getElementById("hero-photo");
    this.texts = [...document.querySelectorAll("[data-text]")];
    this.localBar = document.getElementById("trip-local");
    this.where = document.getElementById("trip-where");
    this.deleteButton = document.getElementById("trip-delete");
    this.deleteButton?.addEventListener("click", () => this.confirmDelete());
    this.editButton = document.getElementById("trip-edit");
    this.editButton?.addEventListener("click", () => this.editInfo());

    /* 共編：改自己顯示給別人看的名字 */
    document.getElementById("presence-name")?.addEventListener("click", () => {
      Trip.editDialog.open({
        title: "你的名字",
        fields: [{ name: "name", label: "顯示給一起編輯的人", placeholder: "例如：Darren", max: 30 }],
        values: { name: Trip.collab.myName() },
        onSubmit: async ({ name }) => Trip.collab.setName(name),
      });
    });
  },

  MAX_DAYS: 60,

  /* 編輯行程資訊：標題、副標、出發日、回程日（改天數）、封面照片 */
  async editInfo() {
    const dest = Trip.state.destination;
    const photoUrl = await Trip.photos.url(dest);
    const trip = Trip.state.trip;
    this.confirmedShrink = null;
    Trip.editDialog.open({
      title: "編輯行程資訊",
      fields: [
        { name: "title", label: "行程標題", required: true, placeholder: "例如：韓國冬日小旅行" },
        { name: "tagline", label: "副標", placeholder: "例如：首爾古宮、釜山海景" },
        { name: "startDate", label: "出發日", type: "date", required: true, half: true },
        { name: "endDate", label: "回程日", type: "date", required: true, half: true },
        { name: "cover", label: dest.room ? "封面照片（一起編輯的人都看得到）" : "封面照片（存在這台裝置）", type: "photo" },
      ],
      values: {
        title: dest.title,
        tagline: dest.tagline,
        startDate: dest.startDate || Trip.config.startDate,
        endDate: trip.days[trip.days.length - 1].date,
        cover: photoUrl,
      },
      onSubmit: async ({ cover, endDate, ...values }) => {
        const count = Trip.utils.daysBetween(values.startDate, endDate) + 1;
        if (!Number.isFinite(count) || count < 1) throw new Error("回程日不能早於出發日");
        if (count > this.MAX_DAYS) throw new Error(`整趟旅程最多 ${this.MAX_DAYS} 天`);

        /* 回程日提早會刪掉最後幾天：有景點的話先提醒，再按一次儲存才刪 */
        const removed = dest.days.slice(count).flatMap((d) => d.items);
        if (removed.length && this.confirmedShrink !== count) {
          this.confirmedShrink = count;
          const from = count + 1;
          const to = dest.days.length;
          throw new Error(`回程日提早會刪掉 Day ${from}${to > from ? `–${to}` : ""} 的 ${removed.length} 個景點；確定的話再按一次「儲存」`);
        }

        const changed = values.title !== dest.title || values.tagline !== (dest.tagline || "") || values.startDate !== dest.startDate;
        if (changed) await this.saveSettings(dest, values);
        if (count !== dest.days.length) {
          await Trip.editor.setDayCount(Trip.state.destination, count, (text) => Trip.editDialog.message(text, "pending"));
        }
        if (cover.changed) await Trip.photos.setCover(Trip.state.destination, cover.blob);
        Trip.editor.rerender();
        Trip.picker.render();
        Trip.addItem.toast("已更新行程資訊");
      },
    });
  },

  saveSettings(dest, values) {
    return Trip.editor.save(dest, (d) => Trip.mutate.setSettings(d, values));
  },

  /* 刪除行程（共用 js/modules/trip-delete.js）：按兩次才刪除 */
  confirmDelete() {
    const dest = Trip.state.destination;
    if (Trip.tripDelete.confirm(this.deleteButton, this.deleteLabel(dest))) {
      Trip.tripDelete.remove(dest, this.deleteButton);
    }
  },

  deleteLabel(dest) {
    return dest?.room ? "離開共編" : "刪除這趟行程";
  },

  /* 依行程來源顯示編輯、刪除按鈕（共編連上後也會呼叫） */
  updateActions() {
    const dest = Trip.state.destination;
    if (!this.localBar || !dest) return;
    const editable = Trip.editor.canEdit(dest);
    this.editButton.hidden = !editable;
    this.localBar.hidden = !(Trip.tripDelete.canDelete(dest) || editable);
    this.where.textContent = dest.room
      ? "共編行程"
      : dest.shared ? "好友分享（唯讀）" : "存在這台裝置";
    Trip.collab.render();
    this.deleteButton.disabled = false;
    Trip.tripDelete.reset(this.deleteButton, this.deleteLabel(dest));
  },

  /* 有封面照片就顯示照片（插圖留著當沒有照片時的畫面） */
  async showPhoto() {
    if (!this.photo) return;
    const dest = Trip.state.destination;
    const url = await Trip.photos.url(dest);
    if (dest !== Trip.state.destination) return;
    const img = this.photo.querySelector("img");
    this.photo.hidden = !url;
    this.art.hidden = Boolean(url);
    if (url && img.getAttribute("src") !== url) {
      img.src = url;
      img.alt = `${dest.title}的封面照片`;
    }
  },

  render(trip, { animate }) {
    document.title = trip.title;
    this.updateActions();
    this.texts.forEach((el) => {
      el.textContent = trip[el.dataset.text] ?? "";
    });

    this.showPhoto();

    if (!this.art || this.currentArt === trip.art) return;
    this.currentArt = trip.art;
    this.art.innerHTML = Trip.art.get(trip.art);
    if (animate) Trip.utils.replay(this.art);
  },
};
