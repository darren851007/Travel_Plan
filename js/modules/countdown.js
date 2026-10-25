/* ============================================================
   出發倒數：每秒更新 天 / 時 / 分 / 秒
   ============================================================ */
window.Trip = window.Trip || {};

Trip.countdown = {
  init() {
    const root = document.getElementById("countdown");
    if (!root) return;

    const target = new Date(Trip.data.departure).getTime();
    const cells = {};
    root.querySelectorAll("[data-unit]").forEach((el) => {
      cells[el.dataset.unit] = el;
    });

    const pad = (n) => String(n).padStart(2, "0");

    /* 回傳 false 代表已出發，不用再更新 */
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        root.innerHTML = '<p class="countdown__done">出發囉！祝旅途愉快 ✈</p>';
        return false;
      }
      const total = Math.floor(diff / 1000);
      cells.days.textContent = Math.floor(total / 86400);
      cells.hours.textContent = pad(Math.floor((total % 86400) / 3600));
      cells.minutes.textContent = pad(Math.floor((total % 3600) / 60));
      cells.seconds.textContent = pad(total % 60);
      return true;
    };

    if (tick()) {
      const timer = setInterval(() => {
        if (!tick()) clearInterval(timer);
      }, 1000);
    }
  },
};
