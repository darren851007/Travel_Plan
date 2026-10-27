/* ============================================================
   出發倒數：每秒更新 天 / 時 / 分 / 秒
   ============================================================ */
window.Trip = window.Trip || {};

Trip.countdown = {
  init() {
    const root = document.getElementById("countdown");
    if (!root) return;

    this.grid = root.querySelector(".countdown__grid");
    this.done = root.querySelector(".countdown__done");
    this.cells = {};
    root.querySelectorAll("[data-unit]").forEach((el) => {
      this.cells[el.dataset.unit] = el;
    });

    setInterval(() => this.tick(), 1000);
  },

  /* 換地點時起飛時間不同，更新倒數目標 */
  render(trip) {
    this.target = new Date(trip.departure).getTime();
    this.tick();
  },

  tick() {
    if (!this.grid || !this.target) return;

    const diff = this.target - Date.now();
    const departed = diff <= 0;
    this.grid.hidden = departed;
    this.done.hidden = !departed;
    if (departed) return;

    const pad = (n) => String(n).padStart(2, "0");
    const total = Math.floor(diff / 1000);
    this.cells.days.textContent = Math.floor(total / 86400);
    this.cells.hours.textContent = pad(Math.floor((total % 86400) / 3600));
    this.cells.minutes.textContent = pad(Math.floor((total % 3600) / 60));
    this.cells.seconds.textContent = pad(total % 60);
  },
};
