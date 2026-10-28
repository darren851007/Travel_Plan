/* ============================================================
   存在這台裝置的行程：用「新增行程」建立的旅程
   只存在這個瀏覽器（localStorage），其他裝置看不到；清除網站資料會一起刪除
   （共編行程另外記在 js/core/collab.js）
   ============================================================ */
window.Trip = window.Trip || {};

/* 我的行程清單：這台裝置的行程＋加入的共編行程 */
Trip.destinations = [];

Trip.localTrips = {
  KEY: "trip-local-data",

  load() {
    try {
      const data = JSON.parse(localStorage.getItem(this.KEY));
      return Array.isArray(data?.destinations) ? data.destinations : [];
    } catch {
      return [];
    }
  },

  /* 回傳是否存成功（無痕模式等情況可能存不了） */
  save(list) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify({ destinations: list }));
      return true;
    } catch {
      return false;
    }
  },

  /* 頁面載入時：讀出這台裝置的行程 */
  apply() {
    const stored = this.load();
    if (this.addUids(stored)) this.save(stored);

    const valid = stored.filter((d) => d?.id && d.days?.length);
    valid.forEach((d) => {
      d.local = true;
      d.checklistIsFull = true;
    });
    Trip.destinations = [...Trip.destinations, ...valid];
  },

  /* 每個景點、航班、住宿都要有 uid 才能編輯；舊資料補上（回傳是否有補） */
  addUids(list) {
    let changed = false;
    const give = (row) => {
      if (row && !row.uid) {
        row.uid = `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
        changed = true;
      }
    };
    for (const d of list) {
      d.days?.forEach((day) => day.items?.forEach(give));
      give(d.flights?.outbound);
      give(d.flights?.inbound);
      d.lodgings?.forEach(give);
    }
    return changed;
  },

  newId() {
    return `my-${Date.now().toString(36)}`;
  },

  add(dest) {
    const trip = { ...dest, local: true, checklistIsFull: true };
    this.addUids([trip]);
    if (!this.save([...this.load(), trip])) return null;
    Trip.destinations.push(trip);
    return trip;
  },

  /* 修改一趟行程（例如新增景點）：update 會拿到可以直接修改的行程物件 */
  update(id, update) {
    const list = this.load();
    const stored = list.find((d) => d.id === id);
    const live = Trip.destinations.find((d) => d.id === id);
    if (!stored || !live) return false;
    update(stored);
    if (!this.save(list)) return false;
    update(live);
    return true;
  },

  remove(id) {
    if (!this.save(this.load().filter((d) => d.id !== id))) return false;
    Trip.destinations = Trip.destinations.filter((d) => d.id !== id);
    return true;
  },
};

Trip.localTrips.apply();
