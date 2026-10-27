/* ============================================================
   SVG 插圖 — 各地點首頁插圖（地標、交通工具、風景）與區塊小插圖
   在 HTML 寫 <div data-art="subway"></div> 就會自動放入對應插圖
   首頁插圖由 hero 模組依目前地點切換（Trip.art.get("heroSeoul")）
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

  /* ---------- 首頁插圖共用：天空、飛機、水面 ---------- */
  const sky = `
    <circle class="f-butter anim-pulse" cx="304" cy="48" r="20"/>
    <g class="anim-float">
      <path class="f-white" d="M30 66 q0 -14 14 -14 q4 -14 20 -12 q14 2 16 14 q12 0 12 12 z"/>
    </g>
    <g class="anim-float-slow">
      <path class="f-white" d="M232 36 q0 -10 10 -10 q3 -10 15 -9 q10 2 12 10 q9 0 9 9 z"/>
    </g>`;

  function plane(x, y) {
    return `
    <g class="anim-plane">
      <g transform="translate(${x} ${y}) rotate(-8)">
        <path d="M-70 26 q30 -12 62 -16" stroke-dasharray="4 7"/>
        <path class="f-peach" d="M6 8 L1 -8 H11 L22 6"/>
        <path class="f-white" d="M0 12 q0 -8 10 -8 h40 q12 0 18 8 q-6 8 -18 8 h-40 q-10 0 -10 -8 z"/>
        <path class="f-sky" d="M26 14 l-8 14 h10 l14 -14"/>
        <circle class="f-ink no-stroke" cx="40" cy="10" r="1.8"/>
        <circle class="f-ink no-stroke" cx="48" cy="10" r="1.8"/>
        <circle class="f-ink no-stroke" cx="56" cy="10" r="1.8"/>
      </g>
    </g>`;
  }

  /* 波浪超出左右的部分由 viewBox 裁掉，不需要 clipPath（同一頁有多張插圖時也不會 ID 重複） */
  function water() {
    return `
    <rect class="f-sky no-stroke" x="0" y="174" width="360" height="46"/>
    <path d="M6 172 H354"/>
    <path class="anim-wave" d="${wavePath(192, -40, 420)}"/>
    <path class="anim-wave-slow" d="${wavePath(208, -60, 420)}"/>`;
  }

  /* 組合：天空 → 飛機 → 地標(body) → 水面 → 水面上的東西(front) */
  function scene({ label, planeAt, body, front = "" }) {
    return `
<svg class="art" viewBox="0 0 360 220" role="img" aria-label="${label}">
  <g class="ink">
    ${sky}
    ${plane(planeAt[0], planeAt[1])}
    ${body}
    ${water()}
    ${front}
  </g>
</svg>`;
  }

  /* ---------- 首爾：南山塔、景福宮、漢江 ---------- */
  const heroSeoul = scene({
    label: "首爾插畫：南山首爾塔、景福宮、漢江與飛機",
    planeAt: [118, 74],
    body: `
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
    <path class="f-teal" d="M54 111 Q64 99 72 97 H108 Q116 99 126 111 Q90 105 54 111 Z"/>`,
  });

  /* ---------- 釜山：甘川洞彩色房子、廣安大橋、小船與海鷗 ---------- */
  const heroBusan = scene({
    label: "釜山插畫：甘川文化村、廣安大橋、小船與海鷗",
    planeAt: [118, 64],
    body: `
    <!-- 海鷗 -->
    <g class="anim-float-slow">
      <path d="M244 80 q5 -6 10 0 q5 -6 10 0"/>
      <path d="M266 94 q4 -5 8 0 q4 -5 8 0"/>
    </g>

    <!-- 甘川文化村 -->
    <path class="f-mint" d="M0 172 Q66 96 150 172 Z"/>
    <rect class="f-peach"  x="14"  y="150" width="20" height="18"/>
    <rect class="f-sky"    x="38"  y="136" width="20" height="18"/>
    <rect class="f-butter" x="62"  y="124" width="22" height="22"/>
    <rect class="f-rose"   x="88"  y="136" width="20" height="18"/>
    <rect class="f-white"  x="112" y="152" width="20" height="16"/>
    <rect class="f-lilac"  x="30"  y="158" width="22" height="14"/>
    <rect class="f-white"  x="68"  y="152" width="20" height="20"/>
    <rect class="f-sky"    x="94"  y="158" width="18" height="14"/>
    <g class="f-ink no-stroke">
      <rect x="21" y="156" width="5" height="5"/>
      <rect x="45" y="142" width="5" height="5"/>
      <rect x="70" y="131" width="5" height="5"/>
      <rect x="95" y="142" width="5" height="5"/>
      <rect x="75" y="158" width="5" height="5"/>
      <rect x="119" y="157" width="5" height="5"/>
    </g>

    <!-- 廣安大橋 -->
    <path d="M180 128 V148 M232 125 V148 M255 129 V148 M278 125 V148 M330 128 V148"/>
    <path d="M150 146 L210 110 Q255 146 300 110 L360 146"/>
    <rect class="f-white" x="207" y="104" width="7" height="68"/>
    <rect class="f-white" x="296" y="104" width="7" height="68"/>
    <rect class="f-white" x="150" y="146" width="212" height="7"/>`,
    front: `
    <!-- 小船 -->
    <g class="anim-float">
      <path d="M268 188 V168"/>
      <path class="f-peach" d="M271 170 l14 14 h-14 z"/>
      <path class="f-white" d="M250 188 h44 l-8 10 h-28 z"/>
    </g>`,
  });

  /* ---------- 東京：東京鐵塔、富士山、新幹線 ---------- */
  const heroTokyo = scene({
    label: "東京插畫：東京鐵塔、富士山與新幹線",
    planeAt: [150, 40],
    body: `
    <!-- 富士山 -->
    <path class="f-lilac" d="M150 172 L212 96 Q222 84 232 96 L300 172 Z"/>
    <path class="f-white" d="M199 112 L212 96 Q222 84 232 96 L245 112 l-8 6 -7 -6 -8 6 -7 -6 -8 6 z"/>

    <!-- 東京鐵塔 -->
    <line x1="96" y1="20" x2="96" y2="36"/>
    <path class="f-peach" d="M70 172 L88 110 L93 62 L96 36 L99 62 L104 110 L122 172 Z"/>
    <path class="f-skysoft" d="M84 172 Q96 146 108 172"/>
    <path d="M80 140 H112 M84 124 H108"/>
    <rect class="f-white" x="82" y="102" width="28" height="9" rx="2"/>
    <rect class="f-white" x="88" y="58" width="16" height="7" rx="2"/>

    <!-- 新幹線 -->
    <g class="anim-chug">
      <path class="f-white" d="M150 170 V150 q0 -6 6 -6 H290 q34 0 54 26 Z"/>
      <rect class="f-sky no-stroke" x="152" y="160" width="178" height="5"/>
      <rect class="f-sky" x="164" y="150" width="14" height="7" rx="2"/>
      <rect class="f-sky" x="188" y="150" width="14" height="7" rx="2"/>
      <rect class="f-sky" x="212" y="150" width="14" height="7" rx="2"/>
      <rect class="f-sky" x="236" y="150" width="14" height="7" rx="2"/>
      <rect class="f-sky" x="260" y="150" width="14" height="7" rx="2"/>
      <path class="f-sky" d="M292 150 q16 0 26 8 h-26 z"/>
    </g>`,
  });

  /* ---------- 通用：丘陵、小樹與小房子（新地點還沒有專屬插圖時使用） ---------- */
  const heroGeneric = scene({
    label: "旅行插畫：山丘、小房子與飛機",
    planeAt: [118, 74],
    body: `
    <path class="f-green" d="M150 172 Q236 96 330 172 Z"/>
    <path class="f-mint" d="M20 172 Q100 112 190 172 Z"/>
    <path class="f-green" d="M58 156 l8 -16 l8 16 z M66 156 v6"/>
    <path class="f-green" d="M150 150 l9 -18 l9 18 z M159 150 v6"/>
    <rect class="f-white" x="232" y="134" width="40" height="30"/>
    <rect class="f-butter" x="246" y="146" width="12" height="18"/>
    <path class="f-peach" d="M224 136 L252 114 L280 136 Z"/>`,
  });

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

  const library = { heroSeoul, heroBusan, heroTokyo, heroGeneric, subway, suitcase, house, planeIcon, planeSide };

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
