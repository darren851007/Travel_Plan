/* ============================================================
   SVG 插圖 — 首爾主題（南山塔、景福宮、漢江、飛機、地鐵…）
   在 HTML 寫 <div data-art="hero"></div> 就會自動放入對應插圖
   會動的部分加上 anim-* class（定義在 css/motion.css）
   ============================================================ */
window.Trip = window.Trip || {};

(function () {
  /* 產生一條可無限平移的波浪線（週期 40px） */
  function wavePath(y, from, to) {
    let d = `M${from} ${y} q10 -5 20 0`;
    for (let x = from + 20; x < to; x += 20) d += " t20 0";
    return d;
  }

  const hero = `
<svg class="art" viewBox="0 0 360 220" role="img" aria-label="首爾插畫：南山首爾塔、景福宮、漢江與飛機">
  <defs>
    <clipPath id="hero-river"><rect x="0" y="174" width="360" height="46"/></clipPath>
  </defs>
  <g class="ink">
    <!-- 太陽、雲 -->
    <circle class="f-butter anim-pulse" cx="304" cy="48" r="20"/>
    <g class="anim-float">
      <path class="f-white" d="M30 66 q0 -14 14 -14 q4 -14 20 -12 q14 2 16 14 q12 0 12 12 z"/>
    </g>
    <g class="anim-float-slow">
      <path class="f-white" d="M232 36 q0 -10 10 -10 q3 -10 15 -9 q10 2 12 10 q9 0 9 9 z"/>
    </g>

    <!-- 飛機與航跡 -->
    <g class="anim-plane">
      <g transform="translate(118 74) rotate(-8)">
        <path d="M-70 26 q30 -12 62 -16" stroke-dasharray="4 7"/>
        <path class="f-peach" d="M6 8 L1 -8 H11 L22 6"/>
        <path class="f-white" d="M0 12 q0 -8 10 -8 h40 q12 0 18 8 q-6 8 -18 8 h-40 q-10 0 -10 -8 z"/>
        <path class="f-sky" d="M26 14 l-8 14 h10 l14 -14"/>
        <circle class="f-ink no-stroke" cx="40" cy="10" r="1.8"/>
        <circle class="f-ink no-stroke" cx="48" cy="10" r="1.8"/>
        <circle class="f-ink no-stroke" cx="56" cy="10" r="1.8"/>
      </g>
    </g>

    <!-- 南山與 N 首爾塔 -->
    <path class="f-mint" d="M150 172 Q222 92 300 172 Z"/>
    <path class="f-green" d="M184 160 l8 -16 l8 16 z M188 160 v6"/>
    <path class="f-green" d="M252 160 l9 -18 l9 18 z M261 160 v6"/>
    <line x1="222" y1="40" x2="222" y2="66"/>
    <circle class="f-ink no-stroke" cx="222" cy="40" r="3"/>
    <rect class="f-white" x="217" y="66" width="10" height="68" rx="2"/>
    <rect class="f-sky" x="211" y="98" width="22" height="8" rx="4"/>
    <rect class="f-peach" x="205" y="74" width="34" height="15" rx="7.5"/>

    <!-- 景福宮 -->
    <rect class="f-rose" x="70" y="106" width="40" height="20"/>
    <rect class="f-rose" x="58" y="134" width="64" height="38"/>
    <path d="M74 142 V172 M90 142 V172 M106 142 V172"/>
    <path class="f-teal" d="M38 138 Q50 126 62 123 H118 Q130 126 142 138 Q90 130 38 138 Z"/>
    <path class="f-teal" d="M54 111 Q64 99 72 97 H108 Q116 99 126 111 Q90 105 54 111 Z"/>

    <!-- 地平線與漢江 -->
    <rect class="f-sky no-stroke" x="0" y="174" width="360" height="46"/>
    <path d="M6 172 H354"/>
    <g clip-path="url(#hero-river)">
      <path class="anim-wave" d="${wavePath(192, -40, 420)}"/>
      <path class="anim-wave-slow" d="${wavePath(208, -60, 420)}"/>
    </g>
  </g>
</svg>`;

  const subway = `
<svg class="art" viewBox="0 0 120 80" aria-hidden="true">
  <g class="ink">
    <path d="M4 72 H116"/>
    <g class="anim-chug">
      <rect class="f-white" x="12" y="16" width="96" height="46" rx="12"/>
      <rect class="f-sky no-stroke" x="14" y="44" width="92" height="8"/>
      <rect class="f-sky" x="22" y="24" width="18" height="13" rx="3"/>
      <rect class="f-sky" x="46" y="24" width="18" height="13" rx="3"/>
      <rect class="f-butter" x="74" y="24" width="24" height="28" rx="3"/>
      <path d="M86 24 V52"/>
      <circle class="f-ink no-stroke" cx="34" cy="66" r="5"/>
      <circle class="f-ink no-stroke" cx="86" cy="66" r="5"/>
    </g>
  </g>
</svg>`;

  const suitcase = `
<svg class="art" viewBox="0 0 100 100" aria-hidden="true">
  <g class="ink anim-sway">
    <path d="M38 26 V16 q0 -4 4 -4 h16 q4 0 4 4 v10"/>
    <rect class="f-peach" x="20" y="26" width="60" height="58" rx="10"/>
    <path d="M40 26 V84 M60 26 V84"/>
    <circle class="f-mint" cx="31" cy="44" r="6"/>
    <rect class="f-butter" x="64" y="58" width="11" height="10" rx="2"/>
    <circle class="f-white" cx="32" cy="90" r="4"/>
    <circle class="f-white" cx="68" cy="90" r="4"/>
  </g>
</svg>`;

  const house = `
<svg class="art" viewBox="0 0 100 90" aria-hidden="true">
  <g class="ink">
    <path class="f-butter anim-pulse" d="M82 10 l3 6 6 1 -4.5 4 1 6 -5.5 -3 -5.5 3 1 -6 -4.5 -4 6 -1 z"/>
    <rect class="f-white" x="20" y="40" width="60" height="38"/>
    <rect class="f-sky" x="26" y="48" width="12" height="12"/>
    <rect class="f-sky" x="62" y="48" width="12" height="12"/>
    <rect class="f-butter" x="42" y="54" width="16" height="24"/>
    <path class="f-teal" d="M6 42 Q28 32 50 16 Q72 32 94 42 Q50 36 6 42 Z"/>
    <path d="M4 78 H96"/>
  </g>
</svg>`;

  /* 航班卡片用的飛機 icon（俯視） */
  const planeIcon = `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path class="ink ink--thin f-peach" d="M12 2c1 0 1.5 1 1.5 2v5l7.5 4v2l-7.5-2.5V18l2.5 2v1.5L12 20.5 8 21.5V20l2.5-2v-5.5L3 15v-2l7.5-4V4c0-1 .5-2 1.5-2z"/>
</svg>`;

  /* 往右飛的小飛機（航線虛線中間） */
  const planeSide = `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <g transform="rotate(90 12 12)">
    <path class="ink ink--thin f-sky" d="M12 2c1 0 1.5 1 1.5 2v5l7.5 4v2l-7.5-2.5V18l2.5 2v1.5L12 20.5 8 21.5V20l2.5-2v-5.5L3 15v-2l7.5-4V4c0-1 .5-2 1.5-2z"/>
  </g>
</svg>`;

  const library = { hero, subway, suitcase, house, planeIcon, planeSide };

  Trip.art = {
    get(name) {
      return library[name] || "";
    },
    /* 把頁面上所有 [data-art] 換成對應的 SVG */
    mount(root = document) {
      root.querySelectorAll("[data-art]").forEach((el) => {
        el.innerHTML = library[el.dataset.art] || "";
      });
    },
  };
})();
