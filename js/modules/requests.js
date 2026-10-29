/* ============================================================
   申請：唯讀的人要成為共編成員，需要擁有者同意
   - 好友打開「分享給好友」的連結，按「加入我的行程」→ 送出加入申請（Google 帳號或輸入名字）
   - 共編裡只能看的成員按「申請一起編輯」
   送出後按鈕變成「申請中（點一下取消）」；申請記在這台裝置，打開網站時（與之後每 30 秒）問結果：
   同意 → 加入行程／可以編輯；拒絕 → 按鈕回到原本的樣子，可以再申請
   - 擁有者：打開那趟行程時跳出對話框；有申請時「分享給好友」旁會出現「申請清單（數量）」按鈕
     同意（可以選要不要讓他編輯）或拒絕
     那趟還只存在擁有者這台裝置的話，同意時會先變成共編行程
   伺服器：server/api/shares.js、server/inbox.js
   ============================================================ */
window.Trip = window.Trip || {};

Trip.requests = {
  KEY: "trip-requests",
  inbox: [],

  init() {
    const $ = (id) => document.getElementById(id);
    this.dialog = $("request-dialog");
    if (!this.dialog) return;
    this.text = $("request-text");
    this.edit = $("request-edit");
    this.hint = $("request-hint");
    this.msg = $("request-msg");
    $("request-approve").addEventListener("click", () => this.resolveCurrent(true));
    $("request-decline").addEventListener("click", () => this.resolveCurrent(false));
    $("request-later").addEventListener("click", () => {
      this.later.add(this.current.id);
      this.dialog.close();
    });
    this.askButton = $("presence-ask");
    this.askButton?.addEventListener("click", () => this.toggleEdit());
    this.listDialog = $("requests-dialog");
    this.listButton = $("trip-requests");
    this.list = $("requests-list");
    this.listButton?.addEventListener("click", () => this.openList());
    $("requests-close")?.addEventListener("click", () => this.listDialog.close());
    this.listDialog?.addEventListener("click", (e) => {
      if (e.target === this.listDialog) this.listDialog.close();
    });
    this.list?.addEventListener("click", (e) => {
      const button = e.target.closest("[data-request]");
      if (!button) return;
      const req = this.inbox.find((r) => r.id === button.dataset.request);
      const edit = button.closest("li").querySelector("[data-request-edit]").checked;
      if (req) this.resolve(req, button.dataset.approve === "1", edit ? "edit" : "view", { fromList: true });
    });
    this.later = new Set();

    Trip.api.onStatus(async () => {
      await Promise.all([this.loadInbox(), this.checkMine()]);
      this.prompt();
      this.renderList();
    });
    /* 畫面開著時每 30 秒：我送出的申請有沒有結果、有沒有人申請我的行程 */
    setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (this.load().length) this.checkMine();
      this.refreshInbox();
    }, 30000);
  },

  /* 換行程時：是我的行程、有人在等就問（申請可能是剛剛才送來的，先重新讀） */
  render() {
    this.prompt();
    this.renderButtons();
    this.renderList();
    this.refreshInbox(15000);
  },

  /* 重新讀收件匣（距離上次超過 minAge 毫秒才讀），有新的就問，清單與按鈕上的數量一起更新 */
  async refreshInbox(minAge = 0) {
    if (!Trip.api.user() || Date.now() - (this.loadedAt || 0) < minAge) return;
    await this.loadInbox();
    this.prompt();
    this.renderList();
  },

  /* ---------- 好友端：送出申請、等結果 ---------- */

  load() {
    try {
      const list = JSON.parse(localStorage.getItem(this.KEY));
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  },

  save(list) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(list));
    } catch {
      /* 記不住：之後就不會自動加入，但申請還是送出去了 */
    }
  },

  pendingFor(token) {
    return this.load().find((r) => r.kind !== "edit" && r.token === token);
  },

  pendingEdit(roomId) {
    return this.load().find((r) => r.kind === "edit" && r.roomId === roomId);
  },

  /* 好友分享的行程上的按鈕：還沒申請就申請，申請中就取消 */
  toggleJoin(dest) {
    const waiting = this.pendingFor(dest.shareToken);
    if (!waiting) {
      this.askJoin(dest);
      return;
    }
    this.cancel(waiting, () => Trip.api.request("POST", "shares/cancel", { token: waiting.token, id: waiting.id }));
  },

  /* 取消：伺服器那邊找不到（已經處理過）也一樣從這台裝置移除 */
  async cancel(req, call) {
    try {
      await call();
    } catch (err) {
      if (err.status !== 404) {
        Trip.addItem.toast(err.message);
        return;
      }
    }
    this.save(this.load().filter((r) => r.id !== req.id));
    this.renderButtons();
    Trip.addItem.toast("已取消申請");
  },

  /* 「加入我的行程」：有擁有者憑證就送申請，否則（舊的分享連結）照舊直接存一份 */
  askJoin(dest) {
    const owner = dest.sharedFrom || "分享的人";
    Trip.account.ask({
      title: "申請加入這趟行程",
      text: `${owner}同意後，這趟行程就會出現在你的行程清單，而且會跟著${owner}的修改即時更新。`,
      googleKey: `share:${dest.shareToken.slice(0, 40)}`,
      submit: (options) => this.send(dest, options),
    });
  },

  async send(dest, { guestName } = {}) {
    const result = await Trip.api.request("POST", "shares/request", { token: dest.shareToken, guestName });
    const list = this.load().filter((r) => r.token !== dest.shareToken);
    list.push({ kind: "join", token: dest.shareToken, id: result.id, title: dest.title || dest.name || "", owner: result.owner || dest.sharedFrom || "" });
    this.save(list);
    this.renderButtons();
    Trip.addItem.toast(`已送出申請，${result.owner || "擁有者"}同意後就會加入你的行程`);
  },

  /* 打開網站時：問每個還在等的申請；同意了就把共編行程加進來 */
  async checkMine() {
    const list = this.load();
    if (!list.length || !Trip.api.status.collab) return;
    const keep = [];
    for (const req of list) {
      try {
        if (req.kind === "edit") {
          const result = await Trip.api.request("POST", `rooms/${encodeURIComponent(req.roomId)}/ask`, { action: "status", id: req.id });
          if (result.status === "approved") Trip.addItem.toast(`擁有者同意了，你可以一起編輯「${req.title}」`);
          else if (result.status === "declined") Trip.addItem.toast(`擁有者沒有同意你編輯「${req.title}」`);
          else if (result.status === "pending") keep.push(req);
          continue;
        }
        const result = await Trip.api.request("POST", "shares/status", { token: req.token, id: req.id });
        if (result.status === "approved" && result.roomId) {
          await Trip.collab.join(result.roomId);
          Trip.picker.render();
          Trip.addItem.toast(`${result.owner || "擁有者"}同意了，「${req.title}」已加入你的行程`);
        } else if (result.status === "declined") {
          Trip.addItem.toast(`${result.owner || "擁有者"}沒有同意你加入「${req.title}」`);
        } else if (result.status === "pending") {
          keep.push(req);
        }
      } catch (err) {
        /* 找不到（例如清掉了訪客身分）就不再問；連不上就下次再問 */
        if (err.status !== 404 && err.status !== 400) keep.push(req);
      }
    }
    /* 問的過程中可能又送出或取消了申請：只更新問過的那幾筆 */
    const asked = new Set(list.map((r) => r.id));
    const kept = new Set(keep.map((r) => r.id));
    this.save(this.load().filter((r) => !asked.has(r.id) || kept.has(r.id)));
    this.renderButtons();
  },

  /* 申請按鈕：申請中顯示「申請中（點一下取消）」，被拒絕或取消後回到原本的樣子 */
  renderButtons() {
    const dest = Trip.state.destination;
    const join = document.getElementById("shared-save");
    if (join && dest?.shared) {
      const waiting = dest.shareToken && this.pendingFor(dest.shareToken);
      join.textContent = waiting ? "申請中（點一下取消）" : "加入我的行程";
      join.classList.toggle("is-waiting", Boolean(waiting));
    }
    if (this.askButton) {
      /* 共編裡只能看的成員才有「申請一起編輯」；已經可以編輯就清掉這台裝置記的申請 */
      const viewer = Boolean(dest?.room && dest.managed && dest.role === "view" && Trip.collab.isLive(dest.room));
      if (dest?.room && dest.role !== "view" && this.pendingEdit(dest.room)) {
        this.save(this.load().filter((r) => !(r.kind === "edit" && r.roomId === dest.room)));
      }
      const waiting = viewer && this.pendingEdit(dest.room);
      this.askButton.hidden = !viewer;
      this.askButton.textContent = waiting ? "申請中（點一下取消）" : "申請一起編輯";
    }
  },

  /* 共編裡只能看的成員：申請一起編輯；申請中再按就取消 */
  async toggleEdit() {
    const dest = Trip.state.destination;
    const path = `rooms/${encodeURIComponent(dest.room)}/ask`;
    const waiting = this.pendingEdit(dest.room);
    if (waiting) {
      this.cancel(waiting, () => Trip.api.request("POST", path, { action: "cancel", id: waiting.id }));
      return;
    }
    try {
      const result = await Trip.api.request("POST", path, { action: "ask" });
      this.save([...this.load(), { kind: "edit", roomId: dest.room, id: result.id, title: dest.title || dest.name || "" }]);
      this.renderButtons();
      Trip.addItem.toast("已送出申請，擁有者同意後你就能一起編輯");
    } catch (err) {
      Trip.addItem.toast(err.message);
    }
  },

  /* ---------- 擁有者端：收件匣 ---------- */

  async loadInbox() {
    if (!Trip.api.user() || !Trip.api.status.collab) {
      this.inbox = [];
      return;
    }
    this.loadedAt = Date.now();
    try {
      this.inbox = (await Trip.api.request("GET", "inbox")).requests || [];
    } catch {
      /* 連不上：沿用上次讀到的 */
    }
  },

  /* 申請的是哪一趟：共編行程用房間代號，還沒共編的用這台裝置上的 ID（變成共編後記下新的 ID） */
  MOVED_KEY: "trip-moved",

  moved() {
    try {
      return JSON.parse(localStorage.getItem(this.MOVED_KEY)) || {};
    } catch {
      return {};
    }
  },

  matches(req, dest) {
    if (!dest || dest.shared) return false;
    if (dest.room) return req.tripRef === dest.room || this.moved()[req.tripRef] === dest.room;
    return dest.local && req.tripRef === dest.id;
  },

  /* 正在看的行程有人在等（而且是我的行程）就跳出對話框；一次一個 */
  prompt() {
    const dest = Trip.state.destination;
    /* 其他對話框開著（例如正在分享）就先不打擾，清單裡看得到 */
    if (!this.dialog || document.querySelector("dialog[open]") || document.body.dataset.view !== "trip") return;
    if (dest?.room && dest.role !== "owner") return;
    const req = this.inbox.find((r) => !this.later.has(r.id) && this.matches(r, dest));
    if (!req) return;
    this.current = req;
    const who = `${req.requester.name || "有人"}${req.requester.guest ? "（訪客）" : req.requester.email ? `（${req.requester.email}）` : ""}`;
    const edit = req.kind === "edit";
    document.getElementById("request-title").textContent = edit ? "有人想一起編輯" : "有人想加入";
    this.text.textContent = edit ? `${who}想一起編輯「${req.title || dest.title}」。` : `${who}想加入「${req.title || dest.title}」。`;
    this.edit.checked = edit;
    this.hint.textContent = dest.room
      ? "同意後他就是這趟共編行程的成員，之後可以在「分享給好友」裡改權限或撤銷。"
      : "同意後這趟行程會變成共編行程（存到網站上），他就是成員。";
    Trip.api.renderMessage(this.msg, "");
    this.setBusy(false);
    this.dialog.showModal();
  },

  /* 我的行程（只存在這台裝置的，或我是擁有者的共編）而且有登入 Google 才有申請 */
  isMine(dest) {
    if (!dest || dest.shared || !Trip.api.user() || !Trip.api.status.collab) return false;
    return dest.room ? dest.role === "owner" : Boolean(dest.local);
  },

  openList() {
    Trip.api.renderMessage(document.getElementById("requests-msg"), "");
    this.renderList();
    this.listDialog.showModal();
  },

  /* 申請清單：這趟行程還在等的申請；沒有申請時按鈕隱藏，處理完最後一筆就關掉對話框 */
  renderList() {
    if (!this.list) return;
    const { esc } = Trip.utils;
    const dest = Trip.state.destination;
    const reqs = this.isMine(dest) ? this.inbox.filter((r) => this.matches(r, dest)) : [];
    if (this.listButton) {
      this.listButton.hidden = !reqs.length;
      this.listButton.textContent = `申請清單（${reqs.length}）`;
    }
    if (!reqs.length && this.listDialog?.open) this.listDialog.close();
    this.list.innerHTML = reqs
      .map((r) => {
        const how = r.requester.guest ? "訪客" : r.requester.email;
        return `
<li class="invite-item">
  <div class="invite-item__head">
    <strong>${esc(r.requester.name || "有人")}${how ? `<span class="field__hint">（${esc(how)}）</span>` : ""}</strong>
    <span class="field__hint">${r.kind === "edit" ? "想一起編輯" : "想加入這趟行程"}</span>
  </div>
  <div class="invite-item__actions">
    <label class="check-row">
      <input type="checkbox" data-request-edit${r.kind === "edit" ? " checked" : ""}>
      <span>可以編輯</span>
    </label>
    <button class="btn-edit" type="button" data-request="${esc(r.id)}" data-approve="0">拒絕</button>
    <button class="btn-edit" type="button" data-request="${esc(r.id)}" data-approve="1">同意</button>
  </div>
</li>`;
      })
      .join("");
  },

  /* 對話框的按鈕 */
  resolveCurrent(approve) {
    return this.resolve(this.current, approve, this.edit.checked ? "edit" : "view");
  },

  async resolve(req, approve, role, { fromList = false } = {}) {
    const box = fromList ? document.getElementById("requests-msg") : this.msg;
    const say = (text, type) => Trip.api.renderMessage(box, text, type);
    this.setBusy(true);
    say("處理中…", "pending");
    try {
      let roomId = null;
      if (approve) {
        let dest = Trip.state.destination;
        /* 還只存在這台裝置：先變成共編行程 */
        if (!dest.room) {
          const oldId = dest.id;
          dest = await Trip.collab.create(dest);
          try {
            localStorage.setItem(this.MOVED_KEY, JSON.stringify({ ...this.moved(), [oldId]: dest.room }));
          } catch {
            /* 記不住：同一趟的其他申請要到另一台裝置處理 */
          }
          Trip.picker.render();
          location.hash = `#/${encodeURIComponent(dest.id)}`;
        }
        roomId = dest.room;
      }
      await Trip.api.request("POST", "inbox/resolve", { id: req.id, approve, roomId, role });
      this.inbox = this.inbox.filter((r) => r.id !== req.id);
      if (this.dialog.open) this.dialog.close();
      this.setBusy(false);
      const done = approve ? `已同意，${req.requester.name || "對方"}下次打開網站就會看到` : "已拒絕";
      say("", "ok");
      Trip.addItem.toast(done);
      this.renderList();
      /* 從跳出的對話框處理：還有人在等就接著問 */
      if (!fromList) setTimeout(() => this.prompt(), 300);
    } catch (err) {
      this.setBusy(false);
      say(err.message, "error");
    }
  },

  setBusy(busy) {
    for (const id of ["request-approve", "request-decline", "request-later"]) document.getElementById(id).disabled = busy;
    this.list?.querySelectorAll("button").forEach((b) => (b.disabled = busy));
  },
};
