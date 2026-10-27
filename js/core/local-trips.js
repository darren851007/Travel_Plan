/* ============================================================
   存在這台裝置的行程：沒有連結 Notion 時，用「新增行程」建立的旅程
   只存在這個瀏覽器（localStorage），其他裝置看不到；清除網站資料會一起刪除
   也記錄這台裝置刪除（隱藏）了哪些內建範例行程，可以再還原
   ============================================================ */
window.Trip = window.Trip || {};

Trip.localTrips = {
  KEY: "trip-local-data",
  HIDDEN_KEY: "trip-hidden-samples",

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

  /* ---------- 內建範例：刪除＝在這台裝置隱藏 ---------- */

  hiddenSamples() {
    try {
      const ids = JSON.parse(localStorage.getItem(this.HIDDEN_KEY));
      return Array.isArray(ids) ? ids : [];
    } catch {
      return [];
    }
  },

  isSample(dest) {
    return Boolean(dest && !dest.local && !dest.notionPageId && Trip.samples?.some((s) => s.id === dest.id));
  },

  hideSample(id) {
    try {
      localStorage.setItem(this.HIDDEN_KEY, JSON.stringify([...new Set([...this.hiddenSamples(), id])]));
    } catch {
      return false;
    }
    Trip.destinations = Trip.destinations.filter((d) => d.id !== id);
    return true;
  },

  /* 還原所有隱藏的範例，放回範例原本的位置（在自己建立的行程前面） */
  restoreSamples() {
    try {
      localStorage.removeItem(this.HIDDEN_KEY);
    } catch {
      return false;
    }
    if (!Trip.dataSource?.syncedAt) {
      const sampleIds = new Set(Trip.samples.map((s) => s.id));
      Trip.destinations = [...Trip.samples, ...Trip.destinations.filter((d) => !sampleIds.has(d.id))];
    }
    return true;
  },

  /* 頁面載入時：隱藏刪除過的範例，再把這台裝置的行程接在後面 */
  apply() {
    const hidden = new Set(this.hiddenSamples());
    if (!Trip.dataSource?.syncedAt) Trip.destinations = Trip.destinations.filter((d) => !hidden.has(d.id));

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
