/* ============================================================
   共編房間 API
   POST /api/rooms { trip }        建立共編行程，回傳 roomId（知道連結的人都能編輯）
   GET  /api/rooms/:id             讀取目前內容
   GET  /api/rooms/:id/ws          WebSocket 即時連線（交給 server/room.js）
   POST /api/rooms/:id/cover       換封面照片（內容是照片本身）；DELETE 移除
   GET  /api/rooms/:id/photos/:pid 讀封面照片
   ============================================================ */
import { checkPost, errorJson, json, readBody } from "../../lib/http.js";

const ROOM_ID = /^[A-Za-z0-9_-]{22}$/;

/* 128 位元的隨機代號：連結就是編輯權限，所以要猜不到 */
function newRoomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const roomStub = (env, roomId) => env.TRIP_ROOM.get(env.TRIP_ROOM.idFromName(roomId));

export async function createRoom({ request, env }) {
  if (!env.TRIP_ROOM) return errorJson("網站尚未開啟共同編輯", 503);
  const blocked = checkPost(request);
  if (blocked) return blocked;

  try {
    const { trip } = await readBody(request);
    const roomId = newRoomId();
    const res = await roomStub(env, roomId).fetch("https://room/init", {
      method: "POST",
      body: JSON.stringify({ trip }),
    });
    const data = await res.json();
    if (!res.ok) return errorJson(data.error || "無法建立共編行程", res.status);
    return json({ roomId, ...data });
  } catch (err) {
    return errorJson(err.message || "無法建立共編行程", err.status || 400);
  }
}

export async function roomRequest({ request, env }, roomId, ws) {
  if (!env.TRIP_ROOM) return errorJson("網站尚未開啟共同編輯", 503);
  if (!ROOM_ID.test(roomId)) return errorJson("找不到這個共編行程", 404);

  /* 換封面：只接受本網站送來的照片 */
  if (request.method === "POST" || request.method === "DELETE") {
    if (request.headers.get("Origin") !== new URL(request.url).origin) return errorJson("只接受本網站的請求", 403);
    if (request.method === "POST" && !/^image\/(jpeg|png|webp)$/.test(request.headers.get("Content-Type") || "")) {
      return errorJson("只接受 JPEG、PNG、WebP 照片", 415);
    }
  }

  if (ws) {
    if (request.headers.get("Upgrade") !== "websocket") return errorJson("需要 WebSocket 連線", 426);
    /* 只接受本網站開的連線 */
    if (request.headers.get("Origin") !== new URL(request.url).origin) return errorJson("只接受本網站的連線", 403);
  }
  return roomStub(env, roomId).fetch(request);
}
