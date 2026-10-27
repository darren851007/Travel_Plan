/* ============================================================
   使用者自己的 Notion 行程：同步後存在這台裝置的瀏覽器
   有快取時取代內建範例；每個人只看得到自己同步的資料
   ============================================================ */
window.Trip = window.Trip || {};

Trip.notionCache = {
  KEY: "trip-notion-data",

  load() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY));
    } catch {
      return null;
    }
  },

  save(data) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  },

  clear() {
    try {
      localStorage.removeItem(this.KEY);
    } catch {
      /* 無法存取就當作沒有快取 */
    }
  },

  /* 頁面載入時：保留內建範例（建立範例頁面時要用），有快取就換成使用者的行程 */
  apply() {
    Trip.samples = Trip.destinations.slice();
    this.defaults = {
      checklistBefore: Trip.config.checklistBefore,
      checklistAfter: Trip.config.checklistAfter,
    };

    const cache = this.load();
    const valid = (cache?.destinations || []).filter(
      (d) => d?.id && d.days?.length && d.flights?.outbound && d.flights?.inbound
    );
    if (!valid.length) return;

    Trip.destinations = valid;
    Trip.dataSource = { type: "notion", syncedAt: cache.syncedAt, parent: cache.parent };
    /* 同步的清單已包含共用項目 */
    Trip.config.checklistBefore = [];
    Trip.config.checklistAfter = [];
  },

  /* 送給轉接程式的網頁設定（交通標籤、預設出發日、共用清單） */
  config() {
    return {
      transports: Trip.config.transports,
      startDate: Trip.config.startDate,
      ...this.defaults,
    };
  },
};

Trip.notionCache.apply();
