/* ============================================================
   存在這台裝置的行程：沒有連結 Notion 時，用「新增行程」建立的旅程
   只存在這個瀏覽器（localStorage），其他裝置看不到；清除網站資料會一起刪除
   ============================================================ */
window.Trip = window.Trip || {};

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

  /* 頁面載入時：把這台裝置的行程接在範例（或 Notion 行程）後面 */
  apply() {
    const valid = this.load().filter((d) => d?.id && d.days?.length && d.flights?.outbound && d.flights?.inbound);
    valid.forEach((d) => {
      d.local = true;
      d.checklistIsFull = true;
    });
    Trip.destinations = [...Trip.destinations, ...valid];
  },

  newId() {
    return `my-${Date.now().toString(36)}`;
  },

  add(dest) {
    const trip = { ...dest, local: true, checklistIsFull: true };
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
