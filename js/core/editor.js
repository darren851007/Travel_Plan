/* ============================================================
   編輯行程資料（景點、航班、住宿、清單、旅程設定、每天的主題與城市）
   - 存在這台裝置的行程：直接改這台裝置的資料
   - 共編行程：送到共編房間（js/core/collab.js），其他人的畫面會即時更新
   每一列用 uid 辨識（這台裝置自己產生的 ID）
   ============================================================ */
window.Trip = window.Trip || {};

Trip.editor = {
  uid() {
    return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  },

  canEdit(dest) {
    if (dest?.room) return Trip.collab.isLive(dest.room);
    return Boolean(dest?.local);
  },

  /* 把修改套用到行程：共編送到房間，這台裝置的直接存 */
  async save(dest, mutate) {
    if (dest.room) {
      await Trip.collab.save(dest, mutate);
      return;
    }
    if (!dest.local || !Trip.localTrips.update(dest.id, mutate)) throw new Error("這個瀏覽器不允許儲存資料（例如無痕模式）");
  },

  /* 執行一個編輯
     table：itinerary / flights / lodging / checklist / settings（說明用）
     op：create / update / delete；mutate(行程物件, id, 資料) 負責改行程資料 */
  async run(dest, { uid, values, mutate }) {
    const id = uid || this.uid();
    await this.save(dest, (d) => mutate(d, id, values));
    return { id, row: values };
  },

  /* 編輯一整天的主題與城市 */
  editDay(dest, dayIndex, { theme, city }) {
    return this.save(dest, (d) => {
      const day = d.days[dayIndex];
      day.theme = theme;
      day.city = city;
    });
  },

  /* 改天數（改回程日）：多的天數在最後加「自由活動」，少的天數連同景點一起刪掉 */
  async setDayCount(dest, count) {
    if (count === dest.days.length) return;
    const lastCity = dest.days[dest.days.length - 1]?.city || "";
    const removed = dest.days.slice(count).flatMap((d) => d.items);
    await this.save(dest, (d) => {
      if (count < d.days.length) {
        d.days = d.days.slice(0, count);
        return;
      }
      let number = d.days.reduce((max, day, i) => Math.max(max, day.number || i + 1), 0);
      while (d.days.length < count) {
        number += 1;
        d.days.push({
          number,
          city: lastCity,
          theme: "",
          items: [{ uid: this.uid(), time: "", title: "自由活動", note: "", transport: [], must: false }],
        });
      }
    });
    /* 這台裝置的照片一起刪掉（共編房間會自己清） */
    if (dest.local) for (const item of removed) Trip.photos.removeLocal(item.photo);
  },

  /* 編輯後重畫行程，停在原本那一天 */
  rerender(dayIndex) {
    const dest = Trip.state.destination;
    const current = dayIndex ?? Trip.itinerary.current ?? 0;
    Trip.state.select(dest.id, false);
    Trip.itinerary.select(Math.min(current, Trip.state.trip.days.length - 1), false);
  },
};

/* ---------- 改行程物件的方法 ---------- */
Trip.mutate = {
  /* 景點：依「第幾天」放進那一天，並依時間排序；回傳那一天的位置 */
  addItem(dest, id, row) {
    let index = dest.days.findIndex((d, i) => (d.number || i + 1) === row.day);
    if (index < 0) {
      dest.days.push({ number: row.day, city: row.city, theme: row.theme || "", items: [] });
      index = dest.days.length - 1;
    }
    const day = dest.days[index];
    if (!day.city && row.city) day.city = row.city;
    if (!day.theme && row.theme) day.theme = row.theme;
    const item = { uid: id, time: row.time, title: row.title, note: row.note, transport: row.transport, must: row.must };
    if (row.photo) item.photo = row.photo;
    day.items.push(item);
    day.items.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    return index;
  },

  findItem(dest, id) {
    for (const [d, day] of dest.days.entries()) {
      const i = day.items.findIndex((item) => item.uid === id);
      if (i >= 0) return { d, i };
    }
    return null;
  },

  /* 刪掉景點；那一天沒有景點了就整天移除（後面的日子往前遞補） */
  removeItem(dest, id) {
    const at = this.findItem(dest, id);
    if (!at) return;
    dest.days[at.d].items.splice(at.i, 1);
    if (!dest.days[at.d].items.length && dest.days.length > 1) dest.days.splice(at.d, 1);
  },

  /* 改景點（可能換到別天）：先放進新的那天，再清掉變成空的原本那天，日子才不會錯位 */
  updateItem(dest, id, row) {
    const at = this.findItem(dest, id);
    if (!at) return this.addItem(dest, id, row);
    const from = dest.days[at.d];
    /* 照片另外存，改景點內容時保留原本的照片 */
    const [old] = from.items.splice(at.i, 1);
    const index = this.addItem(dest, id, { ...row, theme: row.theme ?? "", photo: old?.photo });
    if (!from.items.length && dest.days.length > 1) {
      const k = dest.days.indexOf(from);
      dest.days.splice(k, 1);
      return k < index ? index - 1 : index;
    }
    return index;
  },

  setFlight(dest, id, row) {
    const { type, ...flight } = row;
    dest.flights = { ...(dest.flights || {}), [type === "回程" ? "inbound" : "outbound"]: { ...flight, uid: id } };
  },

  removeFlight(dest, type) {
    if (dest.flights) delete dest.flights[type === "回程" ? "inbound" : "outbound"];
  },

  upsert(list, id, row) {
    const index = list.findIndex((x) => x.uid === id);
    if (index >= 0) list[index] = { ...row, uid: id };
    else list.push({ ...row, uid: id });
  },

  setLodging(dest, id, row) {
    dest.lodgings = dest.lodgings || [];
    this.upsert(dest.lodgings, id, row);
  },

  removeLodging(dest, id) {
    dest.lodgings = (dest.lodgings || []).filter((l) => l.uid !== id);
  },

  /* 清單項目用 id（打勾狀態也是用 id 記錄） */
  setChecklist(dest, id, row) {
    dest.checklist = dest.checklist || [];
    const index = dest.checklist.findIndex((c) => c.id === id);
    const item = { id, text: row.text, hint: row.hint };
    if (index >= 0) dest.checklist[index] = item;
    else dest.checklist.push(item);
  },

  removeChecklist(dest, id) {
    dest.checklist = (dest.checklist || []).filter((c) => c.id !== id);
  },

  setSettings(dest, row) {
    dest.title = row.title;
    dest.tagline = row.tagline;
    dest.startDate = row.startDate;
  },
};
