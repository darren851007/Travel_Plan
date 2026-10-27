/* ============================================================
   行程組合：把一個國家的行程資料，組成頁面要顯示的內容
   日期從出發日依序往後排；住宿依城市自動算入住／退房日
   ============================================================ */
window.Trip = window.Trip || {};

Trip.builder = {
  build(dest) {
    const { config } = Trip;
    const { addDays } = Trip.utils;

    const start = dest.startDate || config.startDate;
    const days = dest.days.map((day, i) => ({ ...day, date: addDays(start, i) }));
    const end = days[days.length - 1].date;
    const nights = days.length - 1;

    return {
      id: dest.id,
      name: dest.name,
      flag: dest.flag || "",
      local: Boolean(dest.local),
      brand: `${dest.name}小旅行`,
      title: dest.title,
      subtitle: `${days.length} 天 ${nights} 夜 · ${dest.tagline}`,
      dateRange: this.formatRange(start, end),
      /* 還沒有去程航班或起飛時間時，倒數算到出發日 00:00 */
      departure: `${start}T${dest.flights?.outbound?.from?.time || "00:00"}:00${config.originTimezone}`,
      art: dest.art,
      transports: config.transports,
      cities: this.cities(days),
      nights,

      /* 航班可以之後再新增：只列出已經有的 */
      flights: [
        dest.flights?.outbound && { type: "去程", date: start, ...dest.flights.outbound },
        dest.flights?.inbound && { type: "回程", date: end, ...dest.flights.inbound },
      ].filter(Boolean),

      days,

      /* Notion 同步與自己建立的行程，清單已包含共用項目 */
      checklist: dest.checklistIsFull
        ? dest.checklist
        : [...config.checklistBefore, ...dest.checklist, ...config.checklistAfter],

      lodgings: this.lodgings(dest.lodgings || [], days),
    };
  },

  /* 依序列出去過的城市（不重複）："首爾", "釜山" */
  cities(days) {
    return [...new Set(days.map((d) => d.city).filter(Boolean))];
  },

  /* 住宿：入住＝該城市第一天，退房＝離開該城市那天（最後一站就是回程日）
     沒填城市的住宿涵蓋整趟旅程 */
  lodgings(list, days) {
    const last = days.length - 1;
    return list
      .map((l) => {
        const index = days.flatMap((d, i) => (!l.city || d.city === l.city ? [i] : []));
        if (!index.length) return null;
        const checkIn = index[0];
        const checkOut = Math.min(index[index.length - 1] + 1, last);
        if (checkOut <= checkIn) return null;
        return {
          ...l,
          nights: checkOut - checkIn,
          checkIn: { date: days[checkIn].date, time: l.checkInTime },
          checkOut: { date: days[checkOut].date, time: l.checkOutTime },
        };
      })
      .filter(Boolean);
  },

  /* "2026-12-18", "2026-12-22" → "2026.12.18 – 12.22" */
  formatRange(start, end) {
    const [y1, m1, d1] = start.split("-");
    const [y2, m2, d2] = end.split("-");
    const tail = y1 === y2 ? `${m2}.${d2}` : `${y2}.${m2}.${d2}`;
    return `${y1}.${m1}.${d1} – ${tail}`;
  },
};
