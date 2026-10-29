/* ============================================================
   即時共同編輯
   - Trip.rooms：我加入的共編行程（存在這台裝置，保留最後一次的內容，離線也能看）
   - Trip.collab：看共編行程時連上房間（WebSocket），有人修改就立刻更新畫面
     存檔帶版本號；同時有人改過時，用最新內容重新套用自己的修改再送一次
   只有部署在 Cloudflare（有共編房間）時才會用到
   ============================================================ */
window.Trip = window.Trip || {};

Trip.rooms = {
  KEY: "trip-rooms",

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
      return true;
    } catch {
      return false;
    }
  },

  destId: (roomId) => `room-${roomId}`,

  /* role：owner（擁有者）、edit（可編輯）、view（唯讀）；managed：有擁有者與邀請的共編（舊的共編沒有） */
  toDest(entry) {
    return {
      ...entry.trip,
      id: this.destId(entry.roomId),
      room: entry.roomId,
      version: entry.version,
      role: entry.role || "edit",
      managed: Boolean(entry.managed),
      checklistIsFull: true,
    };
  },

  /* 頁面載入時：把加入過的共編行程接在清單後面 */
  apply() {
    const valid = this.load().filter((e) => e?.roomId && e.trip?.days?.length);
    Trip.destinations = [...Trip.destinations, ...valid.map((e) => this.toDest(e))];
  },

  /* 共編房間裡存的內容：行程本身（含每列的 uid），不含這台裝置的標記 */
  docOf(dest) {
    const { id, room, version, role, managed, local, shared, sharedFrom, checklistIsFull, order, ...doc } = dest;
    const copy = JSON.parse(JSON.stringify(doc));
    /* 這台裝置的照片不在房間裡，建立共編後另外上傳 */
    const inRoom = (ref) => String(ref || "").startsWith("room:");
    if (!inRoom(copy.cover)) delete copy.cover;
    for (const day of copy.days || []) for (const item of day.items || []) if (!inRoom(item.photo)) delete item.photo;
    if (!checklistIsFull) copy.checklist = [...Trip.config.checklistBefore, ...(copy.checklist || []), ...Trip.config.checklistAfter];
    Trip.localTrips.addUids([copy]);
    copy.flights = copy.flights || {};
    copy.lodgings = copy.lodgings || [];
    return copy;
  },

  /* 收到房間的最新內容：更新這台裝置的紀錄與畫面上的資料，回傳行程物件 */
  receive(roomId, version, trip, access) {
    const list = this.load();
    let entry = list.find((e) => e.roomId === roomId);
    if (entry) {
      entry.version = version;
      entry.trip = trip;
    } else {
      entry = { roomId, version, trip };
      list.push(entry);
    }
    /* 伺服器有告訴我們權限時才更新（存檔確認不會帶權限） */
    if (access?.role) {
      entry.role = access.role;
      entry.managed = Boolean(access.managed);
    }
    this.save(list);

    const fresh = this.toDest(entry);
    const live = Trip.destinations.find((d) => d.id === fresh.id);
    if (!live) {
      Trip.destinations.push(fresh);
      return fresh;
    }
    for (const key of Object.keys(live)) delete live[key];
    Object.assign(live, fresh);
    return live;
  },

  /* 離開：只從我的清單移除，房間與其他人不受影響 */
  remove(roomId) {
    if (!this.save(this.load().filter((e) => e.roomId !== roomId))) return false;
    Trip.destinations = Trip.destinations.filter((d) => d.room !== roomId);
    if (Trip.collab.roomId === roomId) Trip.collab.follow(null);
    return true;
  },
};

Trip.collab = {
  NAME_KEY: "trip-share-name",
  roomId: null,
  ws: null,
  connected: false,
  people: [],
  pending: new Map(),

  available() {
    return Boolean(Trip.api.status.collab);
  },

  myName() {
    try {
      return localStorage.getItem(this.NAME_KEY) || "";
    } catch {
      return "";
    }
  },

  setName(name) {
    try {
      localStorage.setItem(this.NAME_KEY, name);
    } catch {
      /* 記不住也沒關係 */
    }
    this.send({ type: "hello", name });
  },

  /* ---------- 建立與加入 ---------- */

  /* 舊的共編連結（知道連結就能編輯） */
  link(roomId) {
    return `${location.origin}${location.pathname}#/room/${roomId}`;
  },

  /* 專屬邀請連結：第一次用它登入的帳號就綁定 */
  inviteLink(roomId, code) {
    return `${location.origin}${location.pathname}#/join/${roomId}/${code}`;
  },

  /* 擁有者：成員與邀請（action 見 server/room.js 的 manage） */
  access(roomId, body) {
    const path = `rooms/${encodeURIComponent(roomId)}/access`;
    return body ? Trip.api.request("POST", path, body) : Trip.api.request("GET", path);
  },

  /* 把一趟行程變成共編：放進房間，加到我的清單；這台裝置的原行程換成共編版 */
  async create(dest) {
    const trip = Trip.rooms.docOf(dest);
    const result = await Trip.api.request("POST", "rooms", { trip });
    const live = Trip.rooms.receive(result.roomId, result.version, result.trip, result);

    /* 原本有封面、景點照片：上傳到房間（失敗就算了，之後可以再加） */
    const targets = ["cover", ...dest.days.flatMap((d) => d.items.map((i) => i.uid)).filter(Boolean)];
    for (const target of targets) {
      const ref = Trip.photos.photoOf(dest, target);
      if (!ref?.startsWith("dev:")) continue;
      try {
        const blob = await Trip.photos.tx("readonly", (s) => s.get(ref.slice(4)));
        if (blob) await Trip.photos.setRoomPhoto(live, target, blob);
      } catch {
        /* 照片沒上傳成功不影響共編 */
      }
    }
    if (dest.local) {
      Trip.localTrips.remove(dest.id);
      Trip.photos.forget(dest);
    }
    return live;
  },

  /* 打開舊的共編連結：讀取內容並加到我的清單 */
  async join(roomId) {
    const existing = Trip.destinations.find((d) => d.room === roomId);
    if (existing) return existing;
    const data = await Trip.api.request("GET", `rooms/${encodeURIComponent(roomId)}`);
    return Trip.rooms.receive(roomId, data.version, data.trip, data);
  },

  /* 打開專屬邀請連結：用 Google 帳號，或 guestName（以訪客加入）；第一次使用就綁定 */
  async accept(roomId, code, { guestName } = {}) {
    const data = await Trip.api.request("POST", `rooms/${encodeURIComponent(roomId)}/join`, { code, guestName });
    return Trip.rooms.receive(roomId, data.version, data.trip, data);
  },

  /* ---------- 即時連線 ---------- */

  /* 看共編行程時連上，離開就斷線 */
  follow(roomId) {
    if (roomId === this.roomId) return;
    this.disconnect();
    this.roomId = roomId;
    this.retries = 0;
    if (roomId) this.connect();
  },

  connect() {
    if (!this.roomId || this.ws) return;
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${location.host}/api/rooms/${encodeURIComponent(this.roomId)}/ws`);
    this.ws = ws;
    this.render();

    ws.addEventListener("open", () => {
      this.retries = 0;
      this.denied = "";
      ws.send(JSON.stringify({ type: "hello", name: this.myName() }));
    });
    ws.addEventListener("message", (e) => this.onMessage(e.data));
    ws.addEventListener("close", async (e) => {
      if (this.ws !== ws) return;
      const wasConnected = this.connected;
      this.ws = null;
      this.connected = false;
      for (const job of this.pending.values()) job.reject(new Error("連線中斷，請稍後再試"));
      this.pending.clear();
      this.render();
      /* 被擁有者移除，或一開始就連不上：問伺服器是不是沒有權限，是的話就不再重連 */
      if (this.roomId && (e.code === 4003 || !wasConnected) && (await this.checkDenied(this.roomId))) return;
      /* 還在看這趟行程就自動重連（1、2、4… 最多 15 秒） */
      if (this.roomId) {
        clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => this.connect(), Math.min(15000, 1000 * 2 ** this.retries++));
      }
    });
  },

  /* 沒有權限（沒登入、被撤銷）時記下原因顯示在畫面上，回傳 true */
  async checkDenied(roomId) {
    try {
      await Trip.api.request("GET", `rooms/${encodeURIComponent(roomId)}`);
      return false;
    } catch (err) {
      if (err.status !== 401 && err.status !== 403) return false;
      if (this.roomId !== roomId) return true;
      this.denied = err.status === 401 ? "login" : err.message;
      this.render();
      /* 畫面上的編輯按鈕要拿掉 */
      if (Trip.state.destination?.room === roomId && document.body.dataset.view === "trip") {
        Trip.editor.rerender(Trip.itinerary.current);
      }
      return true;
    }
  },

  disconnect() {
    clearTimeout(this.retryTimer);
    const ws = this.ws;
    this.ws = null;
    this.connected = false;
    this.people = [];
    this.roomId = null;
    ws?.close();
    this.render();
  },

  isLive(roomId) {
    return this.connected && this.roomId === roomId;
  },

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(data));
  },

  onMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "state") {
      const first = !this.connected;
      this.connected = true;
      if (msg.you) this.me = msg.you;
      const dest = Trip.rooms.receive(this.roomId, msg.version, msg.trip, msg);
      this.refreshView(dest);
      if (!first && msg.by) Trip.addItem.toast(`${msg.by} 更新了行程`);
      this.render();
      return;
    }

    /* 擁有者把我改成可編輯／唯讀 */
    if (msg.type === "role") {
      const entry = Trip.rooms.load().find((e) => e.roomId === this.roomId);
      if (entry) {
        const dest = Trip.rooms.receive(this.roomId, entry.version, entry.trip, { role: msg.role, managed: true });
        this.refreshView(dest);
      }
      Trip.addItem.toast(msg.role === "view" ? "擁有者把你改成唯讀" : "擁有者讓你可以一起編輯了");
      return;
    }

    if (msg.type === "presence") {
      this.people = msg.people || [];
      this.render();
      return;
    }

    const job = this.pending.get(msg.requestId);
    if (!job) return;

    if (msg.type === "ack") {
      this.pending.delete(msg.requestId);
      Trip.rooms.receive(this.roomId, msg.version, job.doc);
      job.resolve();
      return;
    }

    /* 同時有人改過：換成最新內容，重新套用自己的修改再送一次 */
    if (msg.type === "conflict") {
      this.pending.delete(msg.requestId);
      const dest = Trip.rooms.receive(this.roomId, msg.version, msg.trip);
      this.refreshView(dest);
      if (job.attempts >= 3) {
        job.reject(new Error("其他人正在同時修改，請再試一次"));
        return;
      }
      this.submit(dest, job);
      return;
    }

    if (msg.type === "error") {
      this.pending.delete(msg.requestId);
      job.reject(new Error(msg.error || "儲存失敗"));
    }
  },

  /* 編輯：在最新內容上套用修改，送到房間；成功後畫面才更新 */
  save(dest, mutate) {
    if (!this.isLive(dest.room)) return Promise.reject(new Error("目前沒有連線，連線恢復後再編輯"));
    return new Promise((resolve, reject) => {
      this.submit(dest, { mutate, resolve, reject, attempts: 0 });
    });
  },

  submit(dest, job) {
    const doc = Trip.rooms.docOf(dest);
    job.mutate(doc);
    job.doc = doc;
    job.attempts += 1;
    const requestId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    this.pending.set(requestId, job);
    this.send({ type: "save", requestId, baseVersion: dest.version, trip: doc });
  },

  /* 別人改了：正在看這趟行程就重畫（停在原本那一天） */
  refreshView(dest) {
    if (Trip.state.destination?.room === dest.room && document.body.dataset.view === "trip") {
      Trip.editor.rerender(Trip.itinerary.current);
    }
    if (document.body.dataset.view === "picker") Trip.picker.render();
  },

  /* ---------- 畫面上的「誰在線上」 ---------- */

  render() {
    /* 只能看的成員：「申請一起編輯」要連上才出現 */
    Trip.requests?.renderButtons();
    const bar = document.getElementById("presence");
    if (!bar) return;
    const dest = Trip.state.destination;
    bar.hidden = !dest?.room;
    if (!dest?.room) return;

    const text = document.getElementById("presence-text");
    bar.classList.toggle("is-offline", !this.connected);
    const nameButton = document.getElementById("presence-name");
    if (nameButton) nameButton.hidden = dest.managed;
    const login = document.getElementById("presence-login");
    if (login) login.hidden = this.denied !== "login";
    if (this.denied) {
      text.textContent = this.denied === "login" ? "請用 Google 登入，或請擁有者重新邀請，才能看到最新內容" : this.denied;
      return;
    }
    if (!this.connected) {
      text.textContent = "連線中…（離線時可以看，連上後才能編輯）";
      return;
    }
    const names = this.people.map((p) => (p.id === this.me ? `${p.name}（你）` : p.name));
    const role = { owner: "你是擁有者", view: "你只能看" }[dest.role];
    text.textContent = `${role ? `${role} · ` : ""}正在看：${names.join("、") || "只有你"}`;
  },
};

Trip.rooms.apply();

/* 手機切回這個分頁時，連線可能已經被系統關掉，重新連上 */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && Trip.collab.roomId && !Trip.collab.ws) Trip.collab.connect();
});
