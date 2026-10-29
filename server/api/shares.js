/* ============================================================
   「分享給好友」的加入申請與擁有者的收件匣
   POST /api/shares { tripRef, title }          擁有者（Google 登入）：拿一張放進分享連結的憑證
   POST /api/shares/request { token, guestName } 好友按「加入我的行程」：送出申請（Google 帳號或輸入名字的訪客）
   POST /api/shares/status { token, id }        好友：申請的結果（同意後回傳共編房間代號）
   POST /api/shares/cancel { token, id }        好友：取消還在等的申請
   GET  /api/inbox                              擁有者：還沒處理的申請（加入、申請一起編輯）
   POST /api/inbox/resolve { id, approve, roomId, role }  擁有者：同意（讓對方成為那個共編房間的成員）或拒絕
   憑證是加密過的「擁有者帳號 ID ＋ 哪一趟行程」，好友偽造不了，伺服器也不用另外存
   ============================================================ */
import { checkPost, errorJson, json, readBody } from "../../lib/http.js";
import { getUser, guestCookie, identify, isGoogleConfigured, seal, unseal, userSecret } from "../../lib/session.js";
import { inboxStub } from "./rooms.js";

const ROLES = ["edit", "view"];

/* 共用：檢查請求、讀 JSON；失敗時回傳錯誤的 Response */
async function start(request, env) {
  if (!env.OWNER_INBOX || !env.TRIP_ROOM) return { error: errorJson("網站尚未開啟共同編輯", 503) };
  if (!isGoogleConfigured(env)) return { error: errorJson("網站尚未設定 Google 登入", 503) };
  if (request.method === "POST") {
    const blocked = checkPost(request);
    if (blocked) return { error: blocked };
    try {
      return { body: await readBody(request) };
    } catch (err) {
      return { error: errorJson(err.message, err.status || 400) };
    }
  }
  return { body: {} };
}

const readToken = async (env, token) => {
  const data = typeof token === "string" && token.length < 2000 ? await unseal(token, userSecret(env)) : null;
  return data?.o ? data : null;
};

const inbox = (env, ownerId, path, body) =>
  inboxStub(env, ownerId).fetch(`https://inbox/${path}`, body ? { method: "POST", body: JSON.stringify(body) } : {});

export async function createShare({ request, env }) {
  const { body, error } = await start(request, env);
  if (error) return error;
  const user = await getUser(request, env);
  if (!user) return errorJson("請先用 Google 登入", 401);
  const tripRef = String(body.tripRef || "").slice(0, 100);
  if (!tripRef) return errorJson("不知道要分享哪一趟", 400);
  const token = await seal({ o: user.id, n: user.name, r: tripRef, t: String(body.title || "").slice(0, 100) }, userSecret(env));
  return json({ token });
}

export async function requestJoin({ request, env }) {
  const { body, error } = await start(request, env);
  if (error) return error;
  const share = await readToken(env, body.token);
  if (!share) return errorJson("看不懂這個分享連結", 400);
  const { people, newGuest } = await identify(request, env, body.guestName);
  if (!people.length) return errorJson("請先用 Google 登入，或輸入名字", 401);
  if (people.some((p) => p.id === share.o)) return errorJson("這是你自己分享的行程", 400);

  const res = await inbox(env, share.o, "add", { kind: "join", tripRef: share.r, title: share.t, requester: people[0] });
  const data = await res.json();
  if (!res.ok) return errorJson(data.error || "無法送出申請", res.status);
  const headers = newGuest ? { "Set-Cookie": await guestCookie(request, env, newGuest) } : {};
  return json({ id: data.id, status: data.status, owner: share.n || "" }, 200, headers);
}

export async function requestStatus({ request, env }) {
  const { body, error } = await start(request, env);
  if (error) return error;
  const share = await readToken(env, body.token);
  if (!share) return errorJson("看不懂這個分享連結", 400);
  const { people } = await identify(request, env);
  const res = await inbox(env, share.o, "get", { id: String(body.id || "") });
  const data = await res.json();
  /* 只有申請的人自己看得到結果 */
  if (!res.ok || !people.some((p) => p.id === data.requester?.id)) return errorJson("找不到這個申請", 404);
  return json({ status: data.status, roomId: data.status === "approved" ? data.roomId : null, owner: share.n || "" });
}

export async function cancelRequest({ request, env }) {
  const { body, error } = await start(request, env);
  if (error) return error;
  const share = await readToken(env, body.token);
  if (!share) return errorJson("看不懂這個分享連結", 400);
  const { people } = await identify(request, env);
  const res = await inbox(env, share.o, "cancel", { id: String(body.id || ""), requesterIds: people.map((p) => p.id) });
  return res.ok ? json({ ok: true }) : errorJson((await res.json()).error || "找不到這個申請", res.status);
}

export async function listInbox({ request, env }) {
  const { error } = await start(request, env);
  if (error) return error;
  const user = await getUser(request, env);
  if (!user) return errorJson("請先用 Google 登入", 401);
  const res = await inbox(env, user.id, "list");
  return json(await res.json());
}

/* 同意：先在共編房間讓對方成為成員（房間會確認你是擁有者），再把申請標成已同意 */
export async function resolve({ request, env }) {
  const { body, error } = await start(request, env);
  if (error) return error;
  const { user, header } = await identify(request, env);
  if (!user) return errorJson("請先用 Google 登入", 401);

  const res = await inbox(env, user.id, "get", { id: String(body.id || "") });
  const found = await res.json();
  if (!res.ok) return errorJson(found.error || "找不到這個申請", res.status);
  if (found.status !== "pending") return errorJson("這個申請已經處理過了", 409);

  if (body.approve) {
    const roomId = String(body.roomId || "");
    if (!/^[A-Za-z0-9_-]{22}$/.test(roomId)) return errorJson("要先把行程變成共編", 400);
    const room = env.TRIP_ROOM.get(env.TRIP_ROOM.idFromName(roomId));
    const granted = await room.fetch("https://room/access", {
      method: "POST",
      headers: { "X-Trip-User": header },
      body: JSON.stringify({ action: "grant", user: found.requester, role: ROLES.includes(body.role) ? body.role : "view" }),
    });
    if (!granted.ok) {
      const data = await granted.json().catch(() => ({}));
      return errorJson(data.error || "無法加入成員", granted.status);
    }
  }

  const done = await inbox(env, user.id, "resolve", { id: found.id, approve: Boolean(body.approve), roomId: body.roomId });
  return json(await done.json(), done.status);
}
