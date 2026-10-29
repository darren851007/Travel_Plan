/* ============================================================
   共編房間（Cloudflare Durable Object）：一趟共同編輯的行程
   - 保存行程內容與版本號
   - 用 WebSocket 連著每個正在看的人；有人存檔就立刻推給其他人
   - 版本號不符（同時有人改過）時回傳最新內容，讓網頁重新套用自己的修改
   - 照片（封面、每個景點）：存在房間裡（photo:<id>），行程裡用「room:<id>」指到它
     換照片、刪掉景點時，沒人用的舊照片會一併刪除
   - 權限（access）：建立的人是擁有者；擁有者替每個人產生專屬邀請連結（可編輯或唯讀），
     第一次用它登入的 Google 帳號（或輸入名字的訪客：綁定那個瀏覽器）就綁定這條連結，別人拿到也進不來；擁有者可以撤銷
     登入的帳號與訪客身分由 server/api/rooms.js 從 Cookie 讀出，放在 X-Trip-User（陣列）傳進來
     舊的共編行程（沒有 access）維持「知道連結的人都能編輯」
   使用 Hibernation API：沒有訊息時不佔執行時間，免費額度內即可使用
   ============================================================ */
import { DurableObject } from "cloudflare:workers";

const MAX_TRIP_BYTES = 200_000;
const MAX_PEOPLE = 30;
const MAX_PHOTO_BYTES = 1_500_000;
const PHOTO_ID = /^[A-Za-z0-9_-]{1,40}$/;

/* 只收 JPEG、PNG、WebP（看檔案開頭，不只看 Content-Type） */
function photoType(bytes) {
  const b = new Uint8Array(bytes.slice(0, 12));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const ascii = String.fromCharCode(...b);
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "image/webp";
  return null;
}

const MAX_PHOTOS = 100;
const ITEM_UID = /^[A-Za-z0-9_-]{1,64}$/;
const photoId = (ref) => String(ref || "").match(/^room:([A-Za-z0-9_-]{1,40})$/)?.[1] || null;

/* 行程裡用到的所有照片 */
function photoRefs(trip) {
  const ids = new Set();
  const add = (ref) => {
    const id = photoId(ref);
    if (id) ids.add(id);
  };
  add(trip?.cover);
  for (const day of Array.isArray(trip?.days) ? trip.days : []) {
    for (const item of Array.isArray(day?.items) ? day.items : []) add(item?.photo);
  }
  return ids;
}

const MAX_INVITES = 50;
const ROLES = ["edit", "view"];
const randomCode = () => crypto.randomUUID().replace(/-/g, "");

/* server/api/rooms.js 放進來的身分：Google 帳號在前、訪客在後（可能都沒有） */
function readPeople(request) {
  try {
    const list = JSON.parse(decodeURIComponent(request.headers.get("X-Trip-User") || "[]"));
    return (Array.isArray(list) ? list : [])
      .filter((p) => p?.id)
      .map((p) => ({ id: String(p.id), name: String(p.name || ""), email: String(p.email || ""), guest: Boolean(p.guest) }));
  } catch {
    return [];
  }
}

/* role：owner（擁有者）、edit（可以編輯）、view（唯讀）、null（沒有權限）；who：認出來的是哪個身分 */
function match(access, people) {
  if (!access) return { role: "edit", who: people[0] || null };
  const owner = people.find((p) => p.id === access.owner.id);
  if (owner) return { role: "owner", who: owner };
  for (const inv of Object.values(access.invites)) {
    const who = people.find((p) => p.id === inv.user?.id);
    if (who) return { role: inv.role, who };
  }
  return { role: null, who: null };
}

const roleOf = (access, people) => match(access, people).role;

const canWrite = (role) => role === "owner" || role === "edit";

/* 給擁有者看的成員與邀請清單 */
function accessView(access) {
  return {
    owner: access.owner,
    invites: Object.entries(access.invites)
      .map(([id, inv]) => ({ id, ...inv }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

/* 只接受看起來像行程的資料 */
function validTrip(trip) {
  return Boolean(
    trip && typeof trip === "object" && typeof trip.name === "string" && Array.isArray(trip.days) && trip.days.length
  );
}

export class TripRoom extends DurableObject {
  async state() {
    return (await this.ctx.storage.get("state")) || null;
  }

  async access() {
    return (await this.ctx.storage.get("access")) || null;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const people = readPeople(request);

    /* 建立房間：只有空房間才能寫入第一份行程；建立的人是擁有者 */
    if (url.pathname.endsWith("/init") && request.method === "POST") {
      if (await this.state()) return Response.json({ error: "房間已經存在" }, { status: 409 });
      /* 擁有者一定是 Google 帳號（訪客不能建立） */
      const owner = people.find((p) => !p.guest);
      if (!owner) return Response.json({ error: "請先用 Google 登入" }, { status: 401 });
      const { trip } = await request.json();
      if (!validTrip(trip)) return Response.json({ error: "行程資料不完整" }, { status: 400 });
      const state = { version: 1, trip, updatedAt: new Date().toISOString() };
      const { guest, ...ownerInfo } = owner;
      await this.ctx.storage.put({ state, access: { owner: ownerInfo, invites: {} } });
      return Response.json({ ...state, role: "owner", managed: true });
    }

    const state = await this.state();
    if (!state) return Response.json({ error: "找不到這個共編行程" }, { status: 404 });
    const access = await this.access();

    /* 用專屬邀請連結加入 */
    if (url.pathname.endsWith("/join") && request.method === "POST") return this.join(request, state, access, people);

    const { role, who } = match(access, people);
    if (!role) {
      return people.length
        ? Response.json({ error: "你沒有這趟共編行程的權限，請向擁有者要一條專屬邀請連結" }, { status: 403 })
        : Response.json({ error: "請先用 Google 登入，或重新打開邀請連結以訪客加入" }, { status: 401 });
    }

    /* 成員申請一起編輯（或取消、查結果）：回給 server/api/rooms.js 擁有者是誰，由它去擁有者的收件匣處理 */
    if (url.pathname.endsWith("/ask") && request.method === "POST") {
      if (!access || role === "owner") return Response.json({ error: "你已經可以編輯了" }, { status: 400 });
      return Response.json({ ownerId: access.owner.id, title: state.trip.title || state.trip.name || "", who, role });
    }

    /* 擁有者：看成員與邀請、產生邀請、改權限、撤銷 */
    if (url.pathname.endsWith("/access")) {
      if (role !== "owner" || !access) return Response.json({ error: "只有擁有者可以管理邀請" }, { status: 403 });
      if (request.method === "GET") return Response.json(accessView(access));
      return this.manage(request, access);
    }

    /* 讀照片 */
    const photo = url.pathname.match(/\/photos\/([^/]+)$/);
    if (photo && request.method === "GET") {
      if (!PHOTO_ID.test(photo[1])) return Response.json({ error: "找不到照片" }, { status: 404 });
      const saved = await this.ctx.storage.get(`photo:${photo[1]}`);
      if (!saved) return Response.json({ error: "找不到照片" }, { status: 404 });
      return new Response(saved.data, {
        headers: {
          "Content-Type": saved.type,
          "Cache-Control": "private, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    }

    /* 換照片（POST 照片內容）或移除（DELETE）：?target=cover（封面）或景點的 uid */
    if (/\/(cover|photos)$/.test(url.pathname) && (request.method === "POST" || request.method === "DELETE")) {
      if (!canWrite(role)) return Response.json({ error: "你只能看這趟行程，不能編輯" }, { status: 403 });
      const target = url.pathname.endsWith("/cover") ? "cover" : url.searchParams.get("target") || "";
      return this.setPhoto(request, state, target);
    }

    /* 即時連線 */
    if (request.headers.get("Upgrade") === "websocket") {
      if (this.ctx.getWebSockets().length >= MAX_PEOPLE) {
        return Response.json({ error: "這趟行程同時在線的人太多了" }, { status: 429 });
      }
      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server);
      /* 有權限管理的房間：名字用 Google 帳號的名字（訪客用加入時輸入的名字） */
      server.serializeAttachment({ id: crypto.randomUUID(), name: who?.name || "訪客", userId: access ? who.id : null, role });
      return new Response(null, { status: 101, webSocket: client });
    }

    /* 讀取目前內容 */
    return Response.json({ ...state, role, managed: Boolean(access) });
  }

  /* 加入：第一次使用的身分綁定這條邀請（有 Google 帳號就用帳號，否則用訪客）；已經綁定別人就拒絕 */
  async join(request, state, access, people) {
    if (!access) return Response.json({ ...state, role: "edit", managed: false });
    if (!people.length) return Response.json({ error: "請先用 Google 登入，或輸入名字以訪客加入" }, { status: 401 });
    const { code } = await request.json().catch(() => ({}));
    const invite = Object.values(access.invites).find((inv) => typeof code === "string" && inv.code === code);
    if (!invite) return Response.json({ error: "這個邀請連結已經失效，可能被擁有者撤銷了" }, { status: 404 });

    const role = roleOf(access, people);
    if (!role) {
      if (invite.user) return Response.json({ error: "這個邀請連結已經被其他人使用，請向擁有者要一條你自己的連結" }, { status: 403 });
      invite.user = people[0];
      invite.joinedAt = new Date().toISOString();
      await this.ctx.storage.put("access", access);
    }
    return Response.json({ ...state, role: roleOf(access, people), managed: true });
  }

  /* action：invite（產生邀請）、role（改成可編輯／唯讀）、revoke（撤銷）、
     grant（同意申請：直接讓這個人成為成員；已經是成員就改權限） */
  async manage(request, access) {
    const body = await request.json().catch(() => ({}));
    let invite = access.invites[body.inviteId];

    if (body.action === "grant") {
      const user = body.user;
      if (!user?.id || user.id === access.owner.id || !ROLES.includes(body.role)) {
        return Response.json({ error: "不知道要讓誰加入" }, { status: 400 });
      }
      const found = Object.entries(access.invites).find(([, inv]) => inv.user?.id === user.id);
      if (found) {
        /* 已經是成員：改權限，接著照 role 的流程通知線上的人 */
        body.action = "role";
        body.inviteId = found[0];
        invite = found[1];
      } else {
        if (Object.keys(access.invites).length >= MAX_INVITES) {
          return Response.json({ error: `一趟行程最多 ${MAX_INVITES} 條邀請` }, { status: 413 });
        }
        const now = new Date().toISOString();
        access.invites[randomCode().slice(0, 12)] = {
          label: String(user.name || "").slice(0, 30) || "朋友",
          role: body.role,
          code: randomCode(),
          createdAt: now,
          user: { id: String(user.id), name: String(user.name || ""), email: String(user.email || ""), guest: Boolean(user.guest) },
          joinedAt: now,
        };
      }
    }

    if (body.action === "grant") {
      /* 上面已經加好新成員 */
    } else if (body.action === "invite") {
      if (Object.keys(access.invites).length >= MAX_INVITES) {
        return Response.json({ error: `一趟行程最多 ${MAX_INVITES} 條邀請` }, { status: 413 });
      }
      access.invites[randomCode().slice(0, 12)] = {
        label: String(body.label || "").trim().slice(0, 30) || "朋友",
        role: ROLES.includes(body.role) ? body.role : "edit",
        code: randomCode(),
        createdAt: new Date().toISOString(),
        user: null,
      };
    } else if (body.action === "role" && invite && ROLES.includes(body.role)) {
      invite.role = body.role;
      /* 正在線上的人立刻換權限 */
      for (const ws of this.socketsOf(invite.user)) {
        ws.serializeAttachment({ ...ws.deserializeAttachment(), role: body.role });
        this.send(ws, { type: "role", role: body.role });
      }
    } else if (body.action === "revoke" && invite) {
      delete access.invites[body.inviteId];
      /* 正在線上的人立刻斷線 */
      for (const ws of this.socketsOf(invite.user)) {
        try {
          ws.close(4003, "removed");
        } catch {
          /* 已經斷線 */
        }
      }
    } else {
      return Response.json({ error: "不知道要做什麼" }, { status: 400 });
    }

    await this.ctx.storage.put("access", access);
    if (body.action === "revoke") this.presence();
    return Response.json(accessView(access));
  }

  socketsOf(user) {
    if (!user) return [];
    return this.ctx.getWebSockets().filter((ws) => ws.deserializeAttachment()?.userId === user.id);
  }

  /* 換照片：照片存好後改行程裡的指向，版本號 +1 並通知所有人 */
  async setPhoto(request, state, target) {
    const next = structuredClone(state.trip);
    let holder;
    if (target === "cover") {
      holder = next;
    } else if (ITEM_UID.test(target)) {
      holder = next.days.flatMap((d) => d.items || []).find((item) => item?.uid === target);
      if (!holder) return Response.json({ error: "找不到這個景點，可能已經被刪除" }, { status: 404 });
    } else {
      return Response.json({ error: "不知道要放在哪裡" }, { status: 400 });
    }
    const key = target === "cover" ? "cover" : "photo";

    let newId = null;
    if (request.method === "POST") {
      if (photoRefs(state.trip).size >= MAX_PHOTOS) {
        return Response.json({ error: `一趟行程最多 ${MAX_PHOTOS} 張照片` }, { status: 413 });
      }
      const length = Number(request.headers.get("Content-Length") || 0);
      if (length > MAX_PHOTO_BYTES) return Response.json({ error: "照片太大了" }, { status: 413 });
      const bytes = await request.arrayBuffer();
      if (!bytes.byteLength) return Response.json({ error: "沒有收到照片" }, { status: 400 });
      if (bytes.byteLength > MAX_PHOTO_BYTES) return Response.json({ error: "照片太大了" }, { status: 413 });
      const type = photoType(bytes);
      if (!type) return Response.json({ error: "只接受 JPEG、PNG、WebP 照片" }, { status: 415 });
      newId = crypto.randomUUID().replace(/-/g, "");
      await this.ctx.storage.put(`photo:${newId}`, { type, data: bytes });
      holder[key] = `room:${newId}`;
    } else {
      delete holder[key];
    }

    await this.removeUnused(state.trip, next);

    const by = decodeURIComponent(request.headers.get("X-Trip-Name") || "").trim().slice(0, 30) || "訪客";
    const saved = { version: state.version + 1, trip: next, updatedAt: new Date().toISOString() };
    await this.ctx.storage.put("state", saved);
    this.broadcast({ type: "state", ...saved, by });
    return Response.json(saved);
  }

  /* 舊行程用到、新行程沒用到的照片就刪掉 */
  async removeUnused(before, after) {
    const keep = photoRefs(after);
    const unused = [...photoRefs(before)].filter((id) => !keep.has(id)).map((id) => `photo:${id}`);
    if (unused.length) await this.ctx.storage.delete(unused);
  }

  send(ws, data) {
    try {
      ws.send(JSON.stringify(data));
    } catch {
      /* 對方已經斷線 */
    }
  }

  broadcast(data, except) {
    for (const ws of this.ctx.getWebSockets()) if (ws !== except) this.send(ws, data);
  }

  presence() {
    const people = this.ctx
      .getWebSockets()
      .map((ws) => ws.deserializeAttachment())
      .filter(Boolean)
      .map(({ id, name }) => ({ id, name }));
    this.broadcast({ type: "presence", people });
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== "string" || message.length > MAX_TRIP_BYTES) {
      this.send(ws, { type: "error", error: "資料太大" });
      return;
    }
    let msg;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }

    if (msg.type === "hello") {
      const me = ws.deserializeAttachment() || { id: crypto.randomUUID(), role: "edit" };
      /* 用 Google 帳號登入的人名字固定；舊的共編行程才用自己輸入的名字 */
      if (!me.userId) ws.serializeAttachment({ ...me, name: String(msg.name || "").trim().slice(0, 30) || "訪客" });
      this.send(ws, { type: "state", ...(await this.state()), you: me.id, role: me.role, managed: Boolean(me.userId) });
      this.presence();
      return;
    }

    if (msg.type === "ping") {
      this.send(ws, { type: "pong" });
      return;
    }

    /* 存檔：版本號相同才接受；不同就把最新內容給對方重新套用 */
    if (msg.type === "save") {
      /* 改版前就連上的人沒有 role，那時只有舊的共編行程（大家都能編輯） */
      if (!canWrite(ws.deserializeAttachment()?.role ?? "edit")) {
        this.send(ws, { type: "error", requestId: msg.requestId, error: "你只能看這趟行程，不能編輯" });
        return;
      }
      const state = await this.state();
      if (msg.baseVersion !== state.version) {
        this.send(ws, { type: "conflict", requestId: msg.requestId, ...state });
        return;
      }
      if (!validTrip(msg.trip)) {
        this.send(ws, { type: "error", requestId: msg.requestId, error: "行程資料不完整" });
        return;
      }
      const by = ws.deserializeAttachment()?.name || "訪客";
      const next = { version: state.version + 1, trip: msg.trip, updatedAt: new Date().toISOString() };
      await this.ctx.storage.put("state", next);
      await this.removeUnused(state.trip, next.trip);
      this.send(ws, { type: "ack", requestId: msg.requestId, version: next.version, updatedAt: next.updatedAt });
      this.broadcast({ type: "state", ...next, by }, ws);
    }
  }

  async webSocketClose(ws, code) {
    try {
      ws.close(code, "bye");
    } catch {
      /* 已經關了 */
    }
    this.presence();
  }

  async webSocketError() {
    this.presence();
  }
}
