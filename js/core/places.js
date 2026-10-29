/* ============================================================
   國家與城市的選項（新增行程、編輯這一天的可搜尋選單共用，見 js/core/combobox.js）
   - 有後端時查 /api/places（Cloudflare D1，資料每月由 GeoNames 更新），任何國家、城市都能選
   - 沒有後端（GitHub Pages）或查不到時，改用 js/data/cities.json 的常用國家與城市
   cities.json 也是「人工指定」：常用國家排前面、常用城市的機場（京都 → KIX）以它為準
   國家：{ code, name, flag }；城市：{ name, place: { lat, lon, airport, country } }
   ============================================================ */
window.Trip = window.Trip || {};

Trip.places = {
  /* 讀常用清單、確認有沒有後端；用之前先 await */
  async ready() {
    this.data ||= await Trip.utils.cities();
    await Trip.api.ready;
    if (this.remote === undefined) this.remote = Boolean(Trip.api.status.places);
    return this.data;
  },

  /* 國旗：國家代碼的兩個字母換成區域指示符號（JP → 🇯🇵） */
  flagOf(code) {
    return /^[A-Z]{2}$/.test(code || "") ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "";
  },

  /* 常用清單的第一個國家（預設值） */
  firstCountry() {
    const [name, meta] = Object.entries(this.data.countries)[0];
    return { code: meta.code, name, flag: meta.flag };
  },

  /* 依國家名稱找回國家（舊行程只存了名稱）；常用清單沒有就只有名稱 */
  countryByName(name) {
    const meta = this.data?.countries[name];
    return meta ? { code: meta.code, name, flag: meta.flag } : name ? { code: "", name, flag: "" } : null;
  },

  curatedName(code) {
    return Object.entries(this.data.countries).find(([, meta]) => meta.code === code)?.[0] || "";
  },

  /* 常用國家（cities.json 的順序）排在最前面 */
  popularRank(code) {
    const codes = Object.values(this.data.countries).map((c) => c.code);
    const i = codes.indexOf(code);
    return i < 0 ? codes.length : i;
  },

  async countryOptions(q) {
    await this.ready();
    let list;
    if (this.remote) {
      try {
        const { countries } = await Trip.api.request("GET", `places/countries?q=${encodeURIComponent(q)}`);
        /* 常用國家用常用清單的名稱（例如「韓國」，不是「南韓」）；用那個名稱搜尋也要找得到 */
        list = countries.map((c) => ({ code: c.code, name: this.curatedName(c.code) || c.name_zh, en: c.name_en }));
        const found = new Set(list.map((c) => c.code));
        for (const [name, meta] of Object.entries(this.data.countries)) {
          if (q && name.includes(q) && !found.has(meta.code)) list.push({ code: meta.code, name, en: "" });
        }
      } catch {
        /* 後端查不到：之後先用常用清單 */
        this.remote = false;
      }
    }
    if (!list) {
      const needle = q.toLowerCase();
      list = Object.entries(this.data.countries)
        .map(([name, meta]) => ({ code: meta.code, name, en: "" }))
        .filter((c) => !needle || c.name.includes(q) || c.code.toLowerCase() === needle);
    }
    return list
      .map((c, i) => ({ ...c, i }))
      .sort((a, b) => this.popularRank(a.code) - this.popularRank(b.code) || a.i - b.i)
      .map((c) => ({
        label: `${this.flagOf(c.code)} ${c.name}`,
        detail: c.en && c.en !== c.name ? c.en : "",
        value: { code: c.code, name: c.name, flag: this.flagOf(c.code) },
      }));
  },

  /* 某國的城市；還沒打字時第一個是「不指定城市」 */
  async cityOptions(country, q) {
    await this.ready();
    if (!country) return [];
    let list;
    if (this.remote && country.code) {
      try {
        const { cities } = await Trip.api.request("GET", `places/cities?country=${encodeURIComponent(country.code)}&q=${encodeURIComponent(q)}`);
        list = cities.map((c) => ({
          name: c.name_zh,
          /* 英文名稱、省／州（和名稱一樣的就不重複） */
          detail: [...new Set([c.name_en, c.admin])].filter((t) => t && t !== c.name_zh).join(" · "),
          place: { lat: c.lat, lon: c.lon, airport: c.airport?.iata || "", country: country.code },
        }));
      } catch {
        this.remote = false;
      }
    }
    if (!list) {
      list = this.data.cities
        .filter((c) => c.country === country.name && (!q || c.name.includes(q)))
        .map((c) => ({ name: c.name, detail: "", place: { airport: c.airport || "", country: country.code } }));
    }
    const options = list.map((c) => {
      const place = this.curated(c.name, c.place);
      const detail = [c.detail, place.airport ? `✈ ${place.airport}` : ""].filter(Boolean).join(" · ");
      return { label: c.name, detail, value: { name: c.name, place } };
    });
    return q ? options : [{ label: "不指定城市", detail: "之後再填", value: null }, ...options];
  },

  /* 常用清單裡的同一個城市：GeoNames 的名稱常多一個「市」（京都市、福岡市），比對時忽略 */
  knownCity(name, countryCode) {
    const plain = (n) => String(n || "").replace(/市$/, "");
    return this.data?.cities.find((c) => plain(c.name) === plain(name) && this.data.countries[c.country]?.code === countryCode);
  },

  /* 常用城市：機場以 cities.json 的人工指定為準（例如京都 → 關西 KIX，不是最近的伊丹） */
  curated(name, place) {
    const known = this.knownCity(name, place.country);
    return known?.airport ? { ...place, airport: known.airport } : place;
  },
};
