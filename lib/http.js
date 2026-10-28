/* ============================================================
   Cloudflare Functions 共用：回應 JSON、檢查請求來源、取得使用者的 Notion client
   ============================================================ */
import { createClient, NotionError } from "./notion.js";
import { getSession, sessionCookie, clearSessionCookie } from "./session.js";

export function json(data, status = 200, headers = {}) {
  const res = new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
  for (const [k, v] of Object.entries(headers)) res.headers.append(k, v);
  return res;
}

export const errorJson = (message, status = 400, headers) => json({ error: message }, status, headers);

export function isConfigured(env) {
  /* SESSION_SECRET 可省略（會從 Client Secret 衍生），只要 Notion 整合的 ID 與 Secret */
  return Boolean(env.NOTION_CLIENT_ID && env.NOTION_CLIENT_SECRET);
}

/* 防止其他網站偷偷呼叫：POST 必須來自同一個網站、而且是 JSON */
export function checkPost(request) {
  const origin = new URL(request.url).origin;
  if (request.headers.get("Origin") !== origin) return errorJson("只接受本網站的請求", 403);
  if (!(request.headers.get("Content-Type") || "").startsWith("application/json")) return errorJson("請用 JSON 傳送", 415);
  return null;
}

export async function readBody(request) {
  const text = await request.text();
  if (text.length > 200_000) throw new NotionError(413, "資料太大");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new NotionError(400, "資料格式錯誤");
  }
}

/* 用 Notion 的授權碼或 refresh token 換取 access token */
export async function exchangeToken(env, body) {
  const res = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`)}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new NotionError(401, data.error_description || data.message || "Notion 授權失敗");
  return data;
}

/* 執行需要登入的動作：
   - 沒登入回 401
   - Notion 授權過期時，用 refresh token 換新的再試一次，並更新 Cookie */
export async function withNotion(context, action) {
  const { request, env } = context;
  if (!isConfigured(env)) return errorJson("網站尚未設定 Notion 登入", 503);

  if (request.method === "POST") {
    const blocked = checkPost(request);
    if (blocked) return blocked;
  }

  const session = await getSession(request, env);
  if (!session?.t) return errorJson("請先用 Notion 登入", 401);

  try {
    const body = request.method === "POST" ? await readBody(request) : {};
    try {
      return json(await action(createClient(session.t), body));
    } catch (err) {
      if (err.status !== 401 || !session.r) throw err;
      const fresh = await exchangeToken(env, { grant_type: "refresh_token", refresh_token: session.r });
      const next = { ...session, t: fresh.access_token, r: fresh.refresh_token || session.r };
      const result = await action(createClient(next.t), body);
      return json(result, 200, { "Set-Cookie": await sessionCookie(request, env, next) });
    }
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    const headers = status === 401 ? { "Set-Cookie": clearSessionCookie(request) } : {};
    return errorJson(status === 500 ? "伺服器發生錯誤，請稍後再試" : err.message, status, headers);
  }
}
