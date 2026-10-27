/* ============================================================
   共編房間（Cloudflare Durable Object）：一趟共同編輯的行程
   - 保存行程內容與版本號
   - 用 WebSocket 連著每個正在看的人；有人存檔就立刻推給其他人
   - 版本號不符（同時有人改過）時回傳最新內容，讓網頁重新套用自己的修改
   使用 Hibernation API：沒有訊息時不佔執行時間，免費額度內即可使用
   ============================================================ */
import { DurableObject } from "cloudflare:workers";

const MAX_TRIP_BYTES = 200_000;
const MAX_PEOPLE = 30;

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
