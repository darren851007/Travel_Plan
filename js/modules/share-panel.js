/* ============================================================
   分享給好友（對話框與好友端的橫幅）
   - 分享：產生連結（js/core/share.js），可複製或用手機的分享選單
   - 好友打開：顯示「誰分享的 · 唯讀」，可以「加入我的行程」存到自己的裝置
   - 一起編輯（部署在 Cloudflare 時）：建立共編連結，拿到的人都能即時一起改
   ============================================================ */
window.Trip = window.Trip || {};

Trip.sharePanel = {
  NAME_KEY: "trip-share-name",

  init() {
    const $ = (id) => document.getElementById(id);
    this.bar = $("trip-share-bar");
    this.banner = $("shared-banner");
    this.dialog = $("share-dialog");
    if (!this.bar || !this.dialog) return;

    this.from = $("share-from");
    this.private = $("share-private");
    this.link = $("share-link");
    this.msg = $("share-msg");
    this.native = $("share-native");

    $("trip-share").addEventListener("click", () => this.open());
    $("share-close").addEventListener("click", () => this.dialog.close());
    $("share-copy").addEventListener("click", () => this.copy());
    this.native.addEventListener("click", () => this.shareNative());
    $("shared-save").addEventListener("click", () => this.saveShared());

    this.collab = $("share-collab");
    this.collabHint = $("share-collab-hint");
    this.collabCreate = $("share-collab-create");
    this.collabField = $("share-collab-field");
    this.collabLink = $("share-collab-link");
    this.collabActions = $("share-collab-actions");
    this.collabCreate.addEventListener("click", () => this.createRoom());
    $("share-collab-copy").addEventListener("click", () => this.copyText(this.collabLink.value));
    this.collabLink.addEventListener("focus", () => this.collabLink.select());

    /* 改名字或勾選隱私選項時重新產生連結 */
    this.from.addEventListener("input", () => {
      this.rememberName();
      this.update();
    });
    this.private.addEventListener("change", () => this.update());
    this.link.addEventListener("focus", () => this.link.select());
    this.dialog.addEventListener("click", (e) => {
      if (e.target === this.dialog) this.dialog.close();
    });
  },

  render(trip) {
    if (!this.bar) return;
    const dest = Trip.state.destination;
    this.bar.hidden = Boolean(dest?.shared);
    this.banner.hidden = !dest?.shared;
    if (dest?.shared) document.getElementById("shared-from").textContent = dest.sharedFrom ? `${dest.sharedFrom} ` : "好友";
  },

  open() {
    try {
      this.from.value = localStorage.getItem(this.NAME_KEY) || "";
    } catch {
      this.from.value = "";
    }
    this.private.checked = false;
    this.native.hidden = typeof navigator.share !== "function";
    this.message("");
    this.renderCollab();
    this.dialog.showModal();
    this.update();
  },

  /* 一起編輯：已經是共編行程就直接給連結；否則顯示「建立共編連結」 */
  renderCollab() {
    const dest = Trip.state.destination;
    this.collab.hidden = !Trip.collab.available();
    const ready = Boolean(dest?.room);
    this.collabCreate.parentElement.hidden = ready;
    this.collabField.hidden = !ready;
    this.collabActions.hidden = !ready;
    if (ready) this.collabLink.value = Trip.collab.link(dest.room);
    this.collabHint.textContent = ready
      ? "這趟已經是共編行程，把連結傳給要一起編輯的人。"
      : "建立共編連結後，拿到連結的人都能即時一起修改這趟行程（不用登入）。";
  },

  async createRoom() {
    const dest = Trip.state.destination;
    this.collabCreate.disabled = true;
    this.message("建立共編行程…", "pending");
    try {
      const live = await Trip.collab.create(dest);
      Trip.picker.render();
      location.hash = `#/${encodeURIComponent(live.id)}`;
      /* 路由換到共編行程後，對話框裡改顯示共編連結 */
      setTimeout(() => {
        this.renderCollab();
        this.message("已建立共編行程，把連結傳給要一起編輯的人", "ok");
      }, 50);
    } catch (err) {
      this.message(`無法建立共編：${err.message}`, "error");
    } finally {
      this.collabCreate.disabled = false;
    }
  },

  rememberName() {
    try {
      localStorage.setItem(this.NAME_KEY, this.from.value.trim());
    } catch {
      /* 記不住名字也沒關係 */
    }
  },

  async update() {
    const dest = Trip.state.destination;
    this.link.value = "產生連結中…";
    try {
      this.url = await Trip.share.link(dest, { includePrivate: this.private.checked, from: this.from.value });
      this.link.value = this.url;
      /* 太長的連結在部分 App 可能被截斷 */
      this.message(this.url.length > 8000 ? "這趟行程很長，部分 App 可能無法完整傳送連結，建議用「複製連結」貼到備忘錄或 Email" : "", "pending");
    } catch (err) {
      this.url = "";
      this.link.value = "";
      this.message(`無法產生連結：${err.message}`, "error");
    }
  },

  async copy() {
    if (this.url) await this.copyText(this.url, this.link);
  },

  async copyText(text, input = this.collabLink) {
    try {
      await navigator.clipboard.writeText(text);
      this.message("已複製連結，可以貼給好友", "ok");
    } catch {
      /* 有些瀏覽器不允許，改成選取文字讓使用者自己複製 */
      input.focus();
      input.select();
      this.message("請長按連結自行複製", "pending");
    }
  },

  async shareNative() {
    if (!this.url) return;
    const trip = Trip.state.trip;
    try {
      await navigator.share({ title: trip.title, text: `${trip.title}（${trip.dateRange}）`, url: this.url });
    } catch (err) {
      if (err.name !== "AbortError") this.message("無法開啟分享選單，請改用「複製連結」", "error");
    }
  },

  /* 好友端：存一份到自己的裝置（之後可以自己編輯） */
  saveShared() {
    const { id, shared, sharedFrom, ...trip } = Trip.state.destination;
    const saved = Trip.localTrips.add({ ...trip, id: Trip.localTrips.newId() });
    if (!saved) {
      Trip.addItem.toast("這個瀏覽器不允許儲存資料（例如無痕模式），無法加入");
      return;
    }
    Trip.picker.render();
    location.hash = `#/${encodeURIComponent(saved.id)}`;
    Trip.addItem.toast(`已加入「${saved.title}」到我的行程`);
  },

  message(text, type = "pending") {
    Trip.api.renderMessage(this.msg, text, type);
  },
};
