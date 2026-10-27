/* ============================================================
   編輯行程資料（景點、航班、住宿、清單、旅程設定、每天的主題與城市）
   - 存在這台裝置的行程：直接改這台裝置的資料
   - Notion 同步的行程（需登入）：先寫進 Notion，成功後更新畫面與瀏覽器快取
   內建範例不能編輯
   每一列用 uid 辨識：Notion 的是那一列的頁面 ID，這台裝置的是自己產生的 ID
   ============================================================ */
window.Trip = window.Trip || {};

Trip.editor = {
  uid() {
    return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  },

  canEdit(dest) {
    return Boolean(dest?.local || (dest?.notionPageId && Trip.notionPanel?.status?.loggedIn));
  },

  /* 舊的 Notion 快取沒有每一列的 ID，要重新同步一次才能編輯 */
  needsResync(dest) {
    if (!dest?.notionPageId) return false;
    const rows = [...dest.days.flatMap((d) => d.items), ...(dest.lodgings || [])];
    return rows.some((r) => !r.uid);
  },

  /* 執行一個編輯
     table：itinerary / flights / lodging / checklist / settings
     op：create / update / delete；mutate(行程物件, id, 整理後的資料) 負責改畫面上的資料 */
  async run(dest, { table, op, uid, values, mutate }) {
    if (dest.local) {
      const id = uid || this.uid();
      const saved = Trip.localTrips.update(dest.id, (d) => mutate(d, id, values));
      if (!saved) throw new Error("這個瀏覽器不允許儲存資料（例如無痕模式）");
      return { id, row: values };
    }

    const result = await Trip.notionPanel.request("POST", "notion/row", {
      op, table, pageId: dest.notionPageId, rowId: uid, values, config: Trip.notionCache.config(),
    });
    const id = result.id || uid;
    const row = result.row || values;
    this.applyNotion(dest.id, (d) => mutate(d, id, row));
    return { id, row };
  },

  /* 編輯一整天的主題與城市 */
  async editDay(dest, dayIndex, { theme, city }) {
    const mutate = (d) => {
      const day = d.days[dayIndex];
      day.theme = theme;
      day.city = city;
    };
    if (dest.local) {
      if (!Trip.localTrips.update(dest.id, mutate)) throw new Error("這個瀏覽器不允許儲存資料（例如無痕模式）");
      return;
    }
    const day = dest.days[dayIndex];
    const sorted = [...day.items].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    const result = await Trip.notionPanel.request("POST", "notion/day", { rowIds: sorted.map((i) => i.uid), theme, city });
    this.applyNotion(dest.id, (d) => {
      d.days[dayIndex].theme = result.theme;
      d.days[dayIndex].city = result.city;
    });
  },

  /* Notion 寫入成功後：更新畫面上的資料與瀏覽器快取（不用重新同步） */
  applyNotion(destId, fn) {
    fn(Trip.destinations.find((d) => d.id === destId));
    const cache = Trip.notionCache.load();
    const cached = cache?.destinations?.find((d) => d.id === destId);
    if (cached) {
      fn(cached);
      Trip.notionCache.save(cache);
    }
  },

  /* 編輯後重畫行程，停在原本那一天 */
  rerender(dayIndex) {
    const dest = Trip.state.destination;
    const current = dayIndex ?? Trip.itinerary.current ?? 0;
    Trip.state.select(dest.id, false);
    Trip.itinerary.select(Math.min(current, Trip.state.trip.days.length - 1), false);
  },
};

/* ---------- 改行程物件的方法（這台裝置與 Notion 共用） ---------- */
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
    day.items.push({ uid: id, time: row.time, title: row.title, note: row.note, transport: row.transport, must: row.must });
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
    from.items.splice(at.i, 1);
    const index = this.addItem(dest, id, { ...row, theme: row.theme ?? "" });
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
