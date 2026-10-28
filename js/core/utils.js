/* ============================================================
   共用小工具：跳脫 HTML、日期格式、動態效果偏好
   ============================================================ */
window.Trip = window.Trip || {};

(function () {
  const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
  const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  Trip.utils = {
    /* 把資料塞進 HTML 前先跳脫，避免特殊字元破版 */
    esc(value) {
      return String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
    },

    /* "2026-12-18" → { md: "12/18", weekday: "五" } */
    formatDate(iso) {
      const [y, m, d] = iso.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      return { md: `${m}/${d}`, weekday: WEEKDAYS[date.getDay()] };
    },

    /* 今天的日期字串 "YYYY-MM-DD"（本地時間） */
    todayIso() {
      const t = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
    },

    /* "2026-12-18" + 4 → "2026-12-22" */
    addDays(iso, days) {
      const [y, m, d] = iso.split("-").map(Number);
      const date = new Date(Date.UTC(y, m - 1, d + days));
      return date.toISOString().slice(0, 10);
    },

    /* "2026-12-18" → "2026-12-22" 相差 4 天（格式不對回傳 NaN） */
    daysBetween(from, to) {
      const utc = (iso) => {
        const [y, m, d] = String(iso || "").split("-").map(Number);
        return Date.UTC(y, m - 1, d);
      };
      return Math.round((utc(to) - utc(from)) / 86400000);
    },

    prefersReducedMotion() {
      return reducedMotion.matches;
    },

    /* 城市與國家清單（js/data/cities.json），第一次用到時才讀，之後共用 */
    cities() {
      this._cities ||= fetch("js/data/cities.json").then((res) => {
        if (!res.ok) throw new Error(`連線錯誤（${res.status}）`);
        return res.json();
      });
      this._cities.catch(() => {
        this._cities = null;
      });
      return this._cities;
    },

    /* 移除再加回 class，讓動畫每次都重新播放 */
    replay(el, className = "is-bouncing") {
      el.classList.remove(className);
      void el.offsetWidth;
      el.classList.add(className);
    },
  };
})();
