/* ============================================================
   分享給好友（對話框與好友端的橫幅）
   - 分享：產生連結（js/core/share.js），可複製或用手機的分享選單
   - 好友打開：顯示「誰分享的 · 唯讀」，可以「加入我的行程」存到自己的裝置
   - 一起編輯（部署在 Cloudflare 時）：用 Google 登入後建立共編行程，建立的人是擁有者
     擁有者替每個人產生專屬邀請連結（可編輯或唯讀），可以改權限、撤銷
     共編行程只有擁有者能分享；受邀的人看不到「分享給好友」
     舊的共編行程（改版前建立的）照舊：一條連結，拿到的人都能編輯
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
    this.collabCreate.addEventListener("click", () => {
      if (Trip.api.user()) this.createRoom();
      else Trip.api.login();
    });

    this.invite = $("share-invite");
    this.inviteLabel = $("share-invite-label");
    this.inviteEdit = $("share-invite-edit");
    this.inviteList = $("share-invite-list");
    $("share-invite-create").addEventListener("click", () => this.createInvite());
    this.inviteList.addEventListener("click", (e) => this.onInviteClick(e));
    this.inviteList.addEventListener("change", (e) => {
      const box = e.target.closest("[data-invite-role]");
      if (box) this.manage({ action: "role", inviteId: box.dataset.inviteRole, role: box.checked ? "edit" : "view" }, "已更新權限");
    });
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
    /* 共編行程只有擁有者能分享出去 */
    document.getElementById("trip-share").hidden = Boolean(dest?.room && dest.managed && dest.role !== "owner");
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

  /* 一起編輯：
     - 還不是共編：「建立共編行程」（要先用 Google 登入）
     - 我是擁有者：產生專屬邀請連結、管理成員
     - 舊的共編行程：直接給那一條共編連結 */
  renderCollab() {
    const dest = Trip.state.destination;
    const status = Trip.api.status;
    this.collab.hidden = !Trip.collab.available();
    const room = Boolean(dest?.room);
    const legacy = room && !dest.managed;
    const owner = room && dest.managed && dest.role === "owner";

    this.collabCreate.parentElement.hidden = room;
    this.collabCreate.disabled = !room && !status.google;
    this.collabCreate.textContent = Trip.api.user() ? "建立共編行程" : "用 Google 登入後建立共編";
    this.collabField.hidden = !legacy;
    this.collabActions.hidden = !legacy;
    if (legacy) this.collabLink.value = Trip.collab.link(dest.room);
    this.invite.hidden = !owner;

    this.collabHint.textContent = legacy
      ? "這是舊的共編行程，拿到這條連結的人都能一起編輯。"
      : owner
        ? "替每個人產生一條專屬連結。對方用 Google 登入後，連結就綁定他的帳號，轉給別人也打不開。"
        : !status.google
          ? "網站尚未設定 Google 登入，暫時無法建立共編行程。"
          : "建立後你就是這趟行程的擁有者，可以邀請朋友一起編輯或只能看。";

    if (owner) this.loadInvites();
  },

  /* ---------- 專屬邀請（擁有者） ---------- */

  async loadInvites() {
    const dest = Trip.state.destination;
    this.inviteList.innerHTML = `<li class="field__hint">讀取邀請中…</li>`;
    try {
      this.renderInvites(await Trip.collab.access(dest.room));
    } catch (err) {
      this.inviteList.innerHTML = "";
      this.message(err.message, "error");
    }
  },

  renderInvites({ invites }) {
    const { esc } = Trip.utils;
    const room = Trip.state.destination.room;
    this.invites = invites;
    this.inviteList.innerHTML = invites.length
      ? invites
          .map((inv) => {
            const who = inv.user ? `已加入：${inv.user.name || ""}${inv.user.email ? `（${inv.user.email}）` : ""}` : "等待對方打開連結";
            return `
<li class="invite-item">
  <div class="invite-item__head">
    <strong>${esc(inv.label)}</strong>
    <span class="field__hint">${esc(who)}</span>
  </div>
  ${inv.user ? "" : `<input class="invite-item__link" readonly value="${esc(Trip.collab.inviteLink(room, inv.code))}" aria-label="給${esc(inv.label)}的邀請連結">`}
  <div class="invite-item__actions">
    <label class="check-row">
      <input type="checkbox" data-invite-role="${esc(inv.id)}"${inv.role === "edit" ? " checked" : ""}>
      <span>可以編輯</span>
    </label>
    ${inv.user ? "" : `<button class="btn-edit" type="button" data-invite-copy="${esc(inv.id)}">複製連結</button>`}
    <button class="btn-edit" type="button" data-invite-revoke="${esc(inv.id)}">撤銷</button>
  </div>
</li>`;
          })
          .join("")
      : `<li class="field__hint">還沒有邀請任何人</li>`;
  },

  async createInvite() {
    const label = this.inviteLabel.value.trim();
    const result = await this.manage(
      { action: "invite", label, role: this.inviteEdit.checked ? "edit" : "view" },
      ""
    );
    if (!result) return;
    this.inviteLabel.value = "";
    /* 新的那條在最後：直接複製 */
    const inv = result.invites[result.invites.length - 1];
    if (inv) await this.copyText(Trip.collab.inviteLink(Trip.state.destination.room, inv.code), this.inviteList.querySelector("li:last-child .invite-item__link"));
  },

  onInviteClick(e) {
    const copy = e.target.closest("[data-invite-copy]");
    if (copy) {
      const inv = this.invites.find((i) => i.id === copy.dataset.inviteCopy);
      if (inv) this.copyText(Trip.collab.inviteLink(Trip.state.destination.room, inv.code), copy.closest("li").querySelector("input[readonly]"));
      return;
    }
    const link = e.target.closest(".invite-item__link");
    if (link) link.select();
    /* 撤銷：按一次變成「確定撤銷？」，再按一次才撤銷 */
    const revoke = e.target.closest("[data-invite-revoke]");
    if (!revoke) return;
    if (!revoke.classList.contains("is-confirming")) {
      revoke.classList.add("is-confirming");
      revoke.textContent = "確定撤銷？";
      setTimeout(() => {
        if (!revoke.isConnected) return;
        revoke.classList.remove("is-confirming");
        revoke.textContent = "撤銷";
      }, 3000);
      return;
    }
    this.manage({ action: "revoke", inviteId: revoke.dataset.inviteRevoke }, "已撤銷，對方再也打不開這趟行程");
  },

  /* 送出邀請相關的修改，成功後重畫清單；回傳最新的邀請清單（失敗回傳 null） */
  async manage(body, done) {
    const dest = Trip.state.destination;
    this.message("處理中…", "pending");
    try {
      const result = await Trip.collab.access(dest.room, body);
      this.renderInvites(result);
      this.message(done, "ok");
      return result;
    } catch (err) {
      this.message(err.message, "error");
      if (body.action === "role") this.renderInvites({ invites: this.invites || [] });
      return null;
    }
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
        this.message("已建立共編行程，你是擁有者。替要邀請的人各產生一條專屬連結", "ok");
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
      this.message(input?.classList.contains("invite-item__link") ? "已複製專屬邀請連結，只傳給這個人" : "已複製連結，可以貼給好友", "ok");
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
