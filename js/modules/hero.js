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
    this.resync = document.getElementById("trip-resync");

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

  /* 編輯行程資訊：標題、副標、出發日（存到這台裝置或 Notion 的「旅程設定」）、封面照片 */
  async editInfo() {
    const dest = Trip.state.destination;
    const photoUrl = await Trip.photos.url(dest);
    Trip.editDialog.open({
      title: "編輯行程資訊",
      fields: [
        { name: "title", label: "行程標題", required: true, placeholder: "例如：韓國冬日小旅行" },
        { name: "tagline", label: "副標", placeholder: "例如：首爾古宮、釜山海景" },
        { name: "startDate", label: "出發日", type: "date", required: true, hint: "每天的日期、回程航班日期都會跟著改" },
        { name: "cover", label: dest.room ? "封面照片（一起編輯的人都看得到）" : "封面照片（存在這台裝置）", type: "photo" },
      ],
      values: { title: dest.title, tagline: dest.tagline, startDate: dest.startDate || Trip.config.startDate, cover: photoUrl },
      onSubmit: async ({ cover, ...values }) => {
        const changed = values.title !== dest.title || values.tagline !== (dest.tagline || "") || values.startDate !== dest.startDate;
        if (changed) await this.saveSettings(dest, values);
        if (cover.changed) await Trip.photos.setCover(Trip.state.destination, cover.blob);
        Trip.editor.rerender();
        Trip.picker.render();
        Trip.addItem.toast("已更新行程資訊");
      },
    });
  },

  saveSettings(dest, values) {
    return Trip.editor.run(dest, {
      table: "settings",
      op: dest.settingsId ? "update" : "create",
      uid: dest.settingsId,
      values,
      mutate: (d, id, row) => {
        Trip.mutate.setSettings(d, row);
        if (d.notionPageId) d.settingsId = id;
      },
    });
  },

  /* 刪除行程（共用 js/modules/trip-delete.js）：按兩次才刪除 */
  confirmDelete() {
    const dest = Trip.state.destination;
    if (Trip.tripDelete.confirm(this.deleteButton, this.deleteLabel(dest))) {
      Trip.tripDelete.remove(dest, this.deleteButton);
    }
  },

  deleteLabel(dest) {
    if (dest?.room) return "離開共編";
    return dest?.notionPageId ? "移到 Notion 垃圾桶" : "刪除這趟行程";
  },

  /* 依行程來源顯示刪除按鈕（Notion 登入狀態是之後才知道的，所以面板也會呼叫） */
  updateActions() {
    const dest = Trip.state.destination;
    if (!this.localBar || !dest) return;
    const editable = Trip.editor.canEdit(dest) && !Trip.editor.needsResync(dest);
    this.editButton.hidden = !editable;
    this.resync.hidden = !(Trip.editor.canEdit(dest) && Trip.editor.needsResync(dest));
    this.localBar.hidden = !(Trip.tripDelete.canDelete(dest) || editable);
    this.where.textContent = dest.room
      ? "共編行程"
      : dest.local ? "存在這台裝置" : dest.notionPageId ? "存在你的 Notion" : "範例行程";
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
