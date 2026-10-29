/* ============================================================
   共編房間 API
   POST /api/rooms { trip }        建立共編行程（要先用 Google 登入，建立的人就是擁有者），回傳 roomId
   GET  /api/rooms/:id             讀取目前內容（擁有者與受邀的成員才能讀）
   GET  /api/rooms/:id/ws          WebSocket 即時連線（交給 server/room.js）
   POST /api/rooms/:id/join { code }               用專屬邀請連結加入（第一次使用就綁定這個帳號）
   GET  /api/rooms/:id/access                      擁有者：看成員與邀請
   POST /api/rooms/:id/access { action, … }        擁有者：產生邀請、改成可編輯／唯讀、撤銷
   POST /api/rooms/:id/photos?target=cover|<景點 uid>  換照片（內容是照片本身）；DELETE 移除
   POST /api/rooms/:id/cover       同上，target=cover
   GET  /api/rooms/:id/photos/:pid 讀封面照片
   登入的帳號由這裡從 Cookie 讀出，放在 X-Trip-User 交給房間；瀏覽器自己帶的同名標頭會被丟掉
   這次改版前建立的共編行程沒有擁有者，維持「知道連結的人都能編輯」
   ============================================================ */
import { checkPost, errorJson, json, readBody } from "../../lib/http.js";
import { getUser, isGoogleConfigured } from "../../lib/session.js";

const ROOM_ID = /^[A-Za-z0-9_-]{22}$/;

/* 128 位元的隨機代號：猜不到房間在哪裡 */
function newRoomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const roomStub = (env, roomId) => env.TRIP_ROOM.get(env.TRIP_ROOM.idFromName(roomId));

const userHeader = (user) =>
  user ? encodeURIComponent(JSON.stringify({ id: user.id, name: user.name, email: user.email })) : "";

export async function createRoom({ request, env }) {
  if (!env.TRIP_ROOM) return errorJson("網站尚未開啟共同編輯", 503);
  if (!isGoogleConfigured(env)) return errorJson("網站尚未設定 Google 登入，無法建立共編行程", 503);
  const blocked = checkPost(request);
  if (blocked) return blocked;
  const user = await getUser(request, env);
  if (!user) return errorJson("請先用 Google 登入", 401);

  try {
    const { trip } = await readBody(request);
    const roomId = newRoomId();
    const res = await roomStub(env, roomId).fetch("https://room/init", {
      method: "POST",
      headers: { "X-Trip-User": userHeader(user) },
      body: JSON.stringify({ trip }),
    });
    const data = await res.json();
    if (!res.ok) return errorJson(data.error || "無法建立共編行程", res.status);
    return json({ roomId, ...data });
  } catch (err) {
    return errorJson(err.message || "無法建立共編行程", err.status || 400);
  }
}

/* kind：ws（即時連線）、api（join、access 這類 JSON 請求），其他是讀取內容與照片 */
export async function roomRequest({ request, env }, roomId, kind) {
  if (!env.TRIP_ROOM) return errorJson("網站尚未開啟共同編輯", 503);
  if (!ROOM_ID.test(roomId)) return errorJson("找不到這個共編行程", 404);
  const sameOrigin = request.headers.get("Origin") === new URL(request.url).origin;

  if (kind === "api" && request.method === "POST") {
    const blocked = checkPost(request);
    if (blocked) return blocked;
  } else if (request.method === "POST" || request.method === "DELETE") {
    /* 換照片：只接受本網站送來的照片 */
    if (!sameOrigin) return errorJson("只接受本網站的請求", 403);
    if (request.method === "POST" && !/^image\/(jpeg|png|webp)$/.test(request.headers.get("Content-Type") || "")) {
      return errorJson("只接受 JPEG、PNG、WebP 照片", 415);
    }
  }

  if (kind === "ws") {
    if (request.headers.get("Upgrade") !== "websocket") return errorJson("需要 WebSocket 連線", 426);
    /* 只接受本網站開的連線 */
    if (!sameOrigin) return errorJson("只接受本網站的連線", 403);
  }

  const headers = new Headers(request.headers);
  headers.delete("X-Trip-User");
  const user = await getUser(request, env);
  if (user) headers.set("X-Trip-User", userHeader(user));
  return roomStub(env, roomId).fetch(new Request(request, { headers }));
}
