/* ============================================================
   每日行程：上方日期切換（彈跳動畫），下方時間軸
   日期列可以左右滑：手機用手指，電腦可以用滑鼠滾輪、拖曳或兩側的箭頭
   可以編輯的行程：「編輯這一天」改主題與城市、每個景點都有「編輯」
   ============================================================ */
window.Trip = window.Trip || {};

Trip.itinerary = {
  init() {
    this.tabs = document.getElementById("day-tabs");
    this.panel = document.getElementById("day-panel");
    this.legend = document.getElementById("transport-legend");
    if (!this.tabs || !this.panel) return;

    this.tabs.addEventListener("click", (e) => {
      /* 用滑鼠拖曳捲動後放開，不算點日期 */
      if (this.dragged) {
        this.dragged = false;
        return;
      }
      const tab = e.target.closest(".day-tab");
      if (tab) this.select(Number(tab.dataset.index), true);
    });
    this.initScrolling();

    /* 編輯這一天／編輯景點（js/modules/add-item.js） */
    this.panel.addEventListener("click", (e) => {
      if (e.target.closest("[data-edit-day]")) Trip.addItem.editDay(this.current);
      /* 點景點照片：放大看 */
      const zoom = e.target.closest("[data-zoom-title]");
      if (zoom) this.zoom(zoom.querySelector("img").src, zoom.dataset.zoomTitle);
      /* 時間軸最下方的「新增景點／新增餐廳」：加到正在看的這一天 */
      const add = e.target.closest("[data-add-kind]");
      if (add) Trip.addItem.open(add.dataset.addKind);
      const item = e.target.closest("[data-edit-item]");
      if (item) Trip.addItem.openEdit(item.dataset.editItem);
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
    /* 換了另一趟行程才回到第一天的位置；同一趟（例如剛編輯完）維持原本捲動的位置 */
    const keep = this.tabsTripId === trip.id ? this.tabs.scrollLeft : 0;
    this.tabsTripId = trip.id;
    this.renderTabs();
    this.tabs.scrollLeft = keep;

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

  editable() {
    const dest = Trip.state.destination;
    return Trip.editor.canEdit(dest);
  },

  renderDay(day, index) {
    const { esc, formatDate } = Trip.utils;
    const d = formatDate(day.date);
    const editable = this.editable();
    const dest = Trip.state.destination;
    const items = day.items
      .map((item, i) => {
        /* 餐廳：🍴、餐別標籤、「必吃」 */
        const food = item.kind === "food";
        const meal = food ? Trip.config.meals.find((m) => m.label === item.meal) : null;
        const span = this.timeSpan(item);
        return `
<li class="tl-item${item.must ? " tl-item--must" : ""}${food ? " tl-item--food" : ""}" style="--i:${i}">
  <time class="tl-time">${esc(item.time)}</time>
  <div class="tl-card">
    <h4 class="tl-title">
      ${food ? '<span class="tl-food-icon" aria-label="餐廳">🍴</span>' : ""}${esc(item.title)}
      ${item.must ? `<span class="badge-must">★ ${food ? "必吃" : "必去"}</span>` : ""}
      ${editable && item.uid ? `<button class="btn-edit tl-edit" type="button" data-edit-item="${esc(item.uid)}" aria-label="編輯「${esc(item.title)}」">編輯</button>` : ""}
    </h4>
    ${this.renderRoute(item)}
    ${span ? `<p class="tl-span"><span class="tl-span__main">🕘 ${esc(span.main)}</span>${span.sub ? `<span class="tl-span__sub">${esc(span.sub)}</span>` : ""}</p>` : ""}
    ${item.note ? `<p class="tl-note">${esc(item.note)}</p>` : ""}
    ${item.uid && Trip.photos.photoOf(dest, item.uid) ? `<figure class="tl-photo" data-photo-item="${esc(item.uid)}" hidden><button class="tl-photo__open" type="button" data-zoom-title="${esc(item.title)}" aria-label="放大「${esc(item.title)}」的照片"><img alt="${esc(item.title)}的照片" loading="lazy"></button></figure>` : ""}
    <div class="tl-tags">
      ${meal ? `<span class="pill tone-${esc(meal.tone)}">${esc(meal.label)}</span>` : food && item.meal ? `<span class="pill">${esc(item.meal)}</span>` : ""}
      ${(item.transport || []).map((k) => this.renderTag(k)).join("")}
      ${Trip.utils.mapUrl(item.map) ? `<a class="tl-map" href="${esc(Trip.utils.mapUrl(item.map))}" target="_blank" rel="noopener noreferrer" aria-label="在地圖上打開「${esc(item.title)}」">📍 地圖</a>` : ""}
    </div>
  </div>
</li>`;
      })
      .join("");

    return `
<div class="day-panel__head">
  <h3 class="day-panel__title">Day ${index + 1} · ${d.md}（${d.weekday}）</h3>
  ${day.city ? `<span class="pill tone-sky">${esc(day.city)}</span>` : ""}
  <p class="day-panel__theme">${esc(day.theme)}</p>
  ${editable ? '<button class="btn-edit" type="button" data-edit-day>編輯這一天</button>' : ""}
</div>
${editable ? `
<div class="tl-add tl-add--top">
  <button class="btn btn--small" type="button" data-add-kind="spot">＋ 新增景點</button>
  <button class="btn btn--small" type="button" data-add-kind="food">＋ 新增餐廳</button>
</div>` : ""}
<ol class="timeline">${items}</ol>
${editable ? `
<div class="tl-add">
  <button class="btn btn--ghost btn--small" type="button" data-add-kind="spot">＋ 新增景點</button>
  <button class="btn btn--ghost btn--small" type="button" data-add-kind="food">＋ 新增餐廳</button>
</div>` : ""}`;
  },

  /* 景點照片：網址要非同步讀（這台裝置的照片在 IndexedDB） */
  async showPhotos() {
    const dest = Trip.state.destination;
    for (const figure of this.panel.querySelectorAll("[data-photo-item]")) {
      const url = await Trip.photos.url(dest, figure.dataset.photoItem);
      if (!url || !figure.isConnected) continue;
      figure.querySelector("img").src = url;
      figure.hidden = false;
    }
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
    this.showPhotos();

    if (animate) Trip.utils.replay(this.panel);

    /* 選到的日期要看得到：只捲日期列，不會讓整頁跳走 */
    this.reveal(activeTab, animate && scrollTab);
    this.updateArrows();
  },

  /* 「09:00 出發 → 11:30 結束」＋「抵達 09:30 · 停留 2 小時」；只有出發時間就不顯示
     結束＝抵達（沒填就用出發）＋停留；舊資料只有 endTime（當時＝出發＋停留）也照樣顯示 */
  timeSpan(item) {
    const { addMinutes, minutesBetween, formatMinutes } = Trip.utils;
    const minutes = item.duration || (item.arriveTime ? null : minutesBetween(item.time, item.endTime));
    const end = item.endTime || (minutes ? addMinutes(item.arriveTime || item.time, minutes) : "");
    if (!item.arriveTime && !minutes && !end) return null;
    /* 有路線節點時，出發與抵達已經顯示在路線上，這裡只留在目的地的停留與結束時間 */
    if (this.routeNodes(item).length) {
      return minutes ? { main: `停留 ${formatMinutes(minutes)}${end ? ` → ${end} 結束` : ""}`, sub: "" } : null;
    }
    /* 第一行：出發 → 結束；第二行：抵達、停留 */
    const main = [item.time ? `${item.time} 出發` : "", end ? `${end} 結束` : ""].filter(Boolean).join(" → ");
    const sub = [
      item.arriveTime && item.arriveTime !== item.time ? `抵達 ${item.arriveTime}` : "",
      minutes ? `停留 ${formatMinutes(minutes)}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    return { main, sub };
  },

  /* 路線節點：出發地點 → 中途停靠 → 到達地點；三者都沒填就不顯示 */
  routeNodes(item) {
    const { addMinutes, formatMinutes } = Trip.utils;
    const stops = item.stops || [];
    if (!item.from && !item.to && !stops.length) return [];
    return [
      { kind: "start", name: item.from || "出發", time: item.time ? `${item.time} 出發` : "" },
      ...stops.map((s) => {
        const leave = s.arrive && s.minutes ? addMinutes(s.arrive, s.minutes) : "";
        return {
          kind: "stop",
          name: s.name,
          time: [s.arrive ? `${s.arrive} 抵達` : "", s.minutes ? `停留 ${formatMinutes(s.minutes)}` : "", leave ? `${leave} 離開` : ""]
            .filter(Boolean)
            .join(" · "),
        };
      }),
      { kind: "end", name: item.to || "到達", time: item.arriveTime ? `${item.arriveTime} 抵達` : "" },
    ];
  },

  renderRoute(item) {
    const { esc } = Trip.utils;
    const nodes = this.routeNodes(item);
    if (!nodes.length) return "";
    return `<ol class="tl-route" aria-label="路線">${nodes
      .map(
        (n) => `<li class="tl-route__node tl-route__node--${n.kind}"><span class="tl-route__name">${esc(n.name)}</span>${n.time ? `<span class="tl-route__time">${esc(n.time)}</span>` : ""}</li>`
      )
      .join("")}</ol>`;
  },

  /* ---------- 放大看照片 ---------- */

  zoom(src, title) {
    const viewer = document.getElementById("photo-viewer");
    if (!viewer || !src) return;
    if (!this.viewerReady) {
      this.viewerReady = true;
      document.getElementById("photo-viewer-close").addEventListener("click", () => viewer.close());
      /* 點照片以外的地方（背景）也關閉 */
      viewer.addEventListener("click", (e) => {
        if (!e.target.closest("img")) viewer.close();
      });
    }
    const img = document.getElementById("photo-viewer-img");
    img.src = src;
    img.alt = `${title}的照片`;
    document.getElementById("photo-viewer-caption").textContent = title;
    viewer.showModal();
  },

  /* ---------- 日期列捲動 ---------- */

  initScrolling() {
    const tabs = this.tabs;
    this.prev = document.getElementById("day-tabs-prev");
    this.next = document.getElementById("day-tabs-next");
    const page = () => Math.max(tabs.clientWidth * 0.8, 120);
    this.prev?.addEventListener("click", () => this.scrollTabs(-page()));
    this.next?.addEventListener("click", () => this.scrollTabs(page()));
    tabs.addEventListener("scroll", () => this.updateArrows(), { passive: true });
    window.addEventListener("resize", () => this.updateArrows());

    /* 滑鼠滾輪（上下滾）變成左右捲；已經到頭就讓整頁照常捲動 */
    tabs.addEventListener(
      "wheel",
      (e) => {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        const max = tabs.scrollWidth - tabs.clientWidth;
        const atEdge = (e.deltaY < 0 && tabs.scrollLeft <= 0) || (e.deltaY > 0 && tabs.scrollLeft >= max - 1);
        if (max <= 0 || atEdge) return;
        e.preventDefault();
        tabs.scrollLeft += e.deltaY;
      },
      { passive: false }
    );

    /* 滑鼠拖曳捲動（手指本來就能滑） */
    let start = null;
    tabs.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      start = { x: e.clientX, left: tabs.scrollLeft };
      this.dragged = false;
    });
    tabs.addEventListener("pointermove", (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      if (Math.abs(dx) > 5) {
        this.dragged = true;
        tabs.classList.add("is-dragging");
      }
      if (this.dragged) tabs.scrollLeft = start.left - dx;
    });
    const end = () => {
      start = null;
      tabs.classList.remove("is-dragging");
      /* 拖曳後緊接著的那一下 click 才要忽略；之後的點擊照常 */
      setTimeout(() => (this.dragged = false), 0);
    };
    tabs.addEventListener("pointerup", end);
    tabs.addEventListener("pointerleave", end);
  },

  scrollTabs(by) {
    this.tabs.scrollBy({ left: by, behavior: Trip.utils.prefersReducedMotion() ? "auto" : "smooth" });
  },

  /* 把某個日期捲進日期列的可見範圍（只動日期列） */
  reveal(tab, smooth) {
    if (!tab) return;
    const tabs = this.tabs;
    const box = tabs.getBoundingClientRect();
    const rect = tab.getBoundingClientRect();
    const left = rect.left - box.left + tabs.scrollLeft;
    const right = left + rect.width;
    let target = null;
    if (left < tabs.scrollLeft) target = left - 8;
    else if (right > tabs.scrollLeft + tabs.clientWidth) target = right - tabs.clientWidth + 8;
    if (target === null) return;
    tabs.scrollTo({ left: Math.max(target, 0), behavior: smooth && !Trip.utils.prefersReducedMotion() ? "smooth" : "auto" });
  },

  /* 兩側箭頭：前面或後面還有日期時才出現 */
  updateArrows() {
    if (!this.prev || !this.next) return;
    const tabs = this.tabs;
    const max = tabs.scrollWidth - tabs.clientWidth;
    this.prev.hidden = tabs.scrollLeft <= 8;
    this.next.hidden = tabs.scrollLeft >= max - 8;
  },
};
