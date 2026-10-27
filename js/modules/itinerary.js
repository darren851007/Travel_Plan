/* ============================================================
   每日行程：上方日期切換（彈跳動畫），下方時間軸
   ============================================================ */
window.Trip = window.Trip || {};

Trip.itinerary = {
  init() {
    this.tabs = document.getElementById("day-tabs");
    this.panel = document.getElementById("day-panel");
    this.legend = document.getElementById("transport-legend");
    if (!this.tabs || !this.panel) return;

    this.tabs.addEventListener("click", (e) => {
      const tab = e.target.closest(".day-tab");
      if (tab) this.select(Number(tab.dataset.index), true);
    });

    /* 鍵盤左右鍵切換日期 */
    this.tabs.addEventListener("keydown", (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const count = this.trip.days.length;
      this.select((this.current + step + count) % count, true);
      this.tabs.children[this.current].focus();
    });
  },

  /* 換地點或天數時重畫；旅途中自動跳到今天，否則顯示第一天 */
  render(trip, { animate }) {
    if (!this.tabs || !this.panel) return;
    this.trip = trip;
    this.renderLegend();
    this.renderTabs();
    this.tabs.scrollLeft = 0;

    const todayIndex = trip.days.findIndex((d) => d.date === Trip.utils.todayIso());
    this.select(Math.max(todayIndex, 0), animate, false);
  },

  renderLegend() {
    if (!this.legend) return;
    const { esc } = Trip.utils;
    this.legend.innerHTML = Object.values(this.trip.transports)
      .map((t) => `<span class="pill tone-${esc(t.tone)}">${esc(t.label)}</span>`)
      .join("");
  },

  renderTabs() {
    const { formatDate } = Trip.utils;
    this.tabs.innerHTML = this.trip.days
      .map((day, i) => {
        const d = formatDate(day.date);
        return `
<button class="day-tab" type="button" role="tab" id="day-tab-${i}" data-index="${i}"
        aria-controls="day-panel" aria-selected="false" tabindex="-1">
  <span class="day-tab__label">Day ${i + 1}</span>
  <span class="day-tab__date">${d.md}</span>
  <span class="day-tab__week">週${d.weekday}${day.city ? ` · ${Trip.utils.esc(day.city)}` : ""}</span>
</button>`;
      })
      .join("");
  },

  renderTag(key) {
    const { esc } = Trip.utils;
    const t = this.trip.transports[key];
    if (!t) return "";
    return `<span class="pill tone-${esc(t.tone)}">${esc(t.label)}</span>`;
  },

  renderDay(day, index) {
    const { esc, formatDate } = Trip.utils;
    const d = formatDate(day.date);
    const items = day.items
      .map(
        (item, i) => `
<li class="tl-item${item.must ? " tl-item--must" : ""}" style="--i:${i}">
  <time class="tl-time">${esc(item.time)}</time>
  <div class="tl-card">
    <h4 class="tl-title">
      ${esc(item.title)}
      ${item.must ? '<span class="badge-must">★ 必去</span>' : ""}
    </h4>
    ${item.note ? `<p class="tl-note">${esc(item.note)}</p>` : ""}
    <div class="tl-tags">${(item.transport || []).map((k) => this.renderTag(k)).join("")}</div>
  </div>
</li>`
      )
      .join("");

    return `
<div class="day-panel__head">
  <h3 class="day-panel__title">Day ${index + 1} · ${d.md}（${d.weekday}）</h3>
  ${day.city ? `<span class="pill tone-sky">${esc(day.city)}</span>` : ""}
  <p class="day-panel__theme">${esc(day.theme)}</p>
</div>
<ol class="timeline">${items}</ol>`;
  },

  select(index, animate, scrollTab = true) {
    this.current = index;

    [...this.tabs.children].forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });

    const activeTab = this.tabs.children[index];
    this.panel.setAttribute("aria-labelledby", activeTab.id);
    this.panel.innerHTML = this.renderDay(this.trip.days[index], index);

    if (animate) Trip.utils.replay(this.panel);

    /* 只有點日期時才把標籤捲進畫面，換地點時不要讓整頁跳走 */
    if (animate && scrollTab) {
      activeTab.scrollIntoView({
        behavior: Trip.utils.prefersReducedMotion() ? "auto" : "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  },
};
