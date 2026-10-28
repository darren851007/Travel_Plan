/* ============================================================
   分享給好友：把整趟行程壓縮進連結（#/share/…），不經過任何伺服器
   好友打開是唯讀；可以「加入我的行程」存一份到自己的裝置
   預設不包含訂房編號、電話、旅客與座位，分享的人可以選擇要不要包含
   ============================================================ */
window.Trip = window.Trip || {};

Trip.share = {
  VERSION: 1,

  /* 只留下顯示行程需要的資料（去掉這台裝置的標記、照片等） */
  pack(dest, { includePrivate = false, from = "" } = {}) {
    const flight = (f) => {
      if (!f) return undefined;
      const { uid, seat, passengers, ...rest } = f;
      return includePrivate ? { ...rest, seat, passengers } : rest;
    };
    const trip = {
      name: dest.name,
      flag: dest.flag,
      title: dest.title,
      tagline: dest.tagline,
      art: dest.art,
      startDate: dest.startDate,
      flights: { outbound: flight(dest.flights?.outbound), inbound: flight(dest.flights?.inbound) },
      days: dest.days.map((d) => ({
        city: d.city,
        theme: d.theme,
        items: d.items.map(({ uid, photo, ...item }) => item),
      })),
      lodgings: (dest.lodgings || []).map(({ uid, bookingNo, phone, ...l }) => (includePrivate ? { ...l, bookingNo, phone } : l)),
      /* 舊資料的清單要補上共用項目 */
      checklist: (dest.checklistIsFull
        ? dest.checklist
        : [...Trip.config.checklistBefore, ...dest.checklist, ...Trip.config.checklistAfter]
      ).map(({ id, text, hint, group }) => ({ id, text, hint, ...(group ? { group } : {}) })),
    };
    return { v: this.VERSION, from: String(from || "").trim().slice(0, 30), trip };
  },

  /* 產生分享連結 */
  async link(dest, options) {
    const code = await this.encode(this.pack(dest, options));
    return `${location.origin}${location.pathname}#/share/${code}`;
  },

  /* JSON → 壓縮 → base64url；瀏覽器不支援壓縮時直接 base64url（開頭字母標示格式） */
  async encode(payload) {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    if (typeof CompressionStream === "function") {
      const zipped = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer();
      return `z${this.toBase64Url(new Uint8Array(zipped))}`;
    }
    return `j${this.toBase64Url(bytes)}`;
  },

  async decode(code) {
    const kind = code[0];
    const bytes = this.fromBase64Url(code.slice(1));
    let json;
    if (kind === "z") {
      if (typeof DecompressionStream !== "function") throw new Error("這個瀏覽器太舊，打不開分享的行程");
      const raw = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer();
      json = new TextDecoder().decode(raw);
    } else if (kind === "j") {
      json = new TextDecoder().decode(bytes);
    } else {
      throw new Error("看不懂這個分享連結");
    }

    const payload = JSON.parse(json);
    const trip = payload?.trip;
    if (payload?.v !== this.VERSION || !trip?.days?.length) throw new Error("看不懂這個分享連結");

    /* 好友端：唯讀、清單已含共用項目 */
    return {
      ...trip,
      id: "shared",
      shared: true,
      sharedFrom: payload.from || "",
      flights: trip.flights || {},
      lodgings: trip.lodgings || [],
      checklist: trip.checklist || [],
      checklistIsFull: true,
    };
  },

  toBase64Url(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },

  fromBase64Url(text) {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  },
};
