/* ============================================================
   共編房間 API
   POST /api/rooms { trip }        建立共編行程（要先用 Google 登入，建立的人就是擁有者），回傳 roomId
   GET  /api/rooms/:id             讀取目前內容（擁有者與受邀的成員才能讀）
   GET  /api/rooms/:id/ws          WebSocket 即時連線（交給 server/room.js）
   POST /api/rooms/:id/join { code, guestName }    用專屬邀請連結加入（第一次使用就綁定這個帳號）
                                                   有 guestName 就以訪客加入（只輸入名字，綁定這個瀏覽器），不論有沒有登入 Google
   POST /api/rooms/:id/ask { action, id }          成員申請一起編輯（放進擁有者的收件匣 server/inbox.js）
                                                   action：ask（申請，回傳申請 id）、cancel（取消）、status（結果）
   GET  /api/rooms/:id/access                      擁有者：看成員與邀請
   POST /api/rooms/:id/access { action, … }        擁有者：產生邀請、改成可編輯／唯讀、撤銷
   POST /api/rooms/:id/photos?target=cover|<景點 uid>  換照片（內容是照片本身）；DELETE 移除
   POST /api/rooms/:id/cover       同上，target=cover
   GET  /api/rooms/:id/photos/:pid 讀封面照片
   登入的帳號與訪客身分由這裡從 Cookie 讀出，放在 X-Trip-User（陣列，Google 帳號在前）交給房間；
   瀏覽器自己帶的同名標頭會被丟掉
   這次改版前建立的共編行程沒有擁有者，維持「知道連結的人都能編輯」
   ============================================================ */
import { checkPost, errorJson, json, readBody } from "../../lib/http.js";
import { getUser, guestCookie, identify, isGoogleConfigured } from "../../lib/session.js";

const ROOM_ID = /^[A-Za-z0-9_-]{22}$/;

/* 128 位元的隨機代號：猜不到房間在哪裡 */
function newRoomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const roomStub = (env, roomId) => env.TRIP_ROOM.get(env.TRIP_ROOM.idFromName(roomId));

export const inboxStub = (env, ownerId) => env.OWNER_INBOX.get(env.OWNER_INBOX.idFromName(ownerId));

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
    const { header } = await identify(request, env);
    const res = await roomStub(env, roomId).fetch("https://room/init", {
      method: "POST",
      headers: { "X-Trip-User": header },
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

  const path = new URL(request.url).pathname;
  let body;
  if (kind === "api" && request.method === "POST") {
    try {
      body = await readBody(request);
    } catch (err) {
      return errorJson(err.message, err.status || 400);
    }
  }

  /* 以訪客加入：有輸入名字時給這個瀏覽器一個訪客身分 */
  const { people, newGuest, header } = await identify(request, env, path.endsWith("/join") ? body?.guestName : "");
  const headers = new Headers(request.headers);
  headers.delete("X-Trip-User");
  if (people.length) headers.set("X-Trip-User", header);
  const init = body === undefined ? { headers } : { method: "POST", headers, body: JSON.stringify(body) };
  const res = await roomStub(env, roomId).fetch(new Request(request, init));

  /* 申請一起編輯：房間確認是成員後，到擁有者的收件匣處理（擁有者的帳號 ID 不回給瀏覽器） */
  if (path.endsWith("/ask") && res.ok) {
    const { ownerId, title, who, role } = await res.json();
    const inbox = (name, data) => inboxStub(env, ownerId).fetch(`https://inbox/${name}`, { method: "POST", body: JSON.stringify(data) });
    const id = String(body?.id || "");

    if (body?.action === "cancel") {
      const done = await inbox("cancel", { id, requesterIds: people.map((p) => p.id) });
      return done.ok ? json({ ok: true }) : done;
    }
    if (body?.action === "status") {
      const found = await inbox("get", { id });
      const data = await found.json();
      if (!found.ok || !people.some((p) => p.id === data.requester?.id)) return errorJson("找不到這個申請", 404);
      return json({ status: data.status, role });
    }
    if (role !== "view") return errorJson("你已經可以編輯了", 400);
    const added = await inbox("add", { kind: "edit", tripRef: roomId, title, requester: who });
    const data = await added.json();
    return added.ok ? json({ id: data.id, status: data.status }) : errorJson(data.error || "無法送出申請", added.status);
  }

  if (!newGuest || !res.ok) return res;
  const out = new Response(res.body, res);
  out.headers.append("Set-Cookie", await guestCookie(request, env, newGuest));
  return out;
}
