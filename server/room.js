/* ============================================================
   共編房間（Cloudflare Durable Object）：一趟共同編輯的行程
   - 保存行程內容與版本號
   - 用 WebSocket 連著每個正在看的人；有人存檔就立刻推給其他人
   - 版本號不符（同時有人改過）時回傳最新內容，讓網頁重新套用自己的修改
   - 照片（封面、每個景點）：存在房間裡（photo:<id>），行程裡用「room:<id>」指到它
     換照片、刪掉景點時，沒人用的舊照片會一併刪除
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

  async fetch(request) {
    const url = new URL(request.url);

    /* 建立房間：只有空房間才能寫入第一份行程 */
    if (url.pathname.endsWith("/init") && request.method === "POST") {
      if (await this.state()) return Response.json({ error: "房間已經存在" }, { status: 409 });
      const { trip } = await request.json();
      if (!validTrip(trip)) return Response.json({ error: "行程資料不完整" }, { status: 400 });
      const state = { version: 1, trip, updatedAt: new Date().toISOString() };
      await this.ctx.storage.put("state", state);
      return Response.json(state);
    }

    const state = await this.state();
    if (!state) return Response.json({ error: "找不到這個共編行程" }, { status: 404 });

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
      server.serializeAttachment({ id: crypto.randomUUID(), name: "訪客" });
      return new Response(null, { status: 101, webSocket: client });
    }

    /* 讀取目前內容 */
    return Response.json(state);
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
    const people = this.ctx.getWebSockets().map((ws) => ws.deserializeAttachment()).filter(Boolean);
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
      const me = ws.deserializeAttachment() || { id: crypto.randomUUID() };
      ws.serializeAttachment({ ...me, name: String(msg.name || "").trim().slice(0, 30) || "訪客" });
      this.send(ws, { type: "state", ...(await this.state()), you: me.id });
      this.presence();
      return;
    }

    if (msg.type === "ping") {
      this.send(ws, { type: "pong" });
      return;
    }

    /* 存檔：版本號相同才接受；不同就把最新內容給對方重新套用 */
    if (msg.type === "save") {
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
