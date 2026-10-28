/* ============================================================
   登入狀態：把使用者的 Notion 授權加密後存在他自己裝置的 Cookie
   伺服器不保存任何人的授權；只有持有密鑰的轉接程式能解開
   密鑰用 SESSION_SECRET；沒設定時，從 NOTION_CLIENT_SECRET 衍生（少設一個密鑰，手機也好設定）
   用 Web Crypto（AES-GCM），Cloudflare 與 Node 都能執行
   ============================================================ */

const COOKIE = "trip_session";
const STATE_COOKIE = "trip_oauth_state";
const MAX_AGE = 60 * 60 * 24 * 90; /* 90 天 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64Url = (bytes) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (text) =>
  Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

/* 加密 Cookie 用的密鑰：有 SESSION_SECRET 就用它，否則由 Notion Client Secret 加上用途標籤衍生 */
export function sessionSecret(env) {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  return env.NOTION_CLIENT_SECRET ? `trip-plan-session-v1:${env.NOTION_CLIENT_SECRET}` : "";
}

async function keyFrom(secret) {
  if (!secret || secret.length < 32) throw new Error("加密 Cookie 的密鑰未設定或太短（至少 32 字元）");
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function seal(data, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(secret);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(data))));
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv);
  out.set(cipher, iv.length);
  return toBase64Url(out);
}

/* 解不開（被竄改、換過密鑰、格式錯誤）時回傳 null */
export async function unseal(text, secret) {
  try {
    const bytes = fromBase64Url(text);
    const key = await keyFrom(secret);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, key, bytes.slice(12));
    return JSON.parse(decoder.decode(plain));
  } catch {
    return null;
  }
}

export function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

function cookieHeader(request, name, value, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/* ---------- 登入狀態 ---------- */

export async function getSession(request, env) {
  const raw = readCookie(request, COOKIE);
  return raw ? unseal(raw, sessionSecret(env)) : null;
}

export async function sessionCookie(request, env, session) {
  return cookieHeader(request, COOKIE, await seal(session, sessionSecret(env)), MAX_AGE);
}

export const clearSessionCookie = (request) => cookieHeader(request, COOKIE, "", 0);

/* ---------- 登入時防止偽造回呼的 state ---------- */

export function newState() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(24)));
}

export const stateCookie = (request, state) => cookieHeader(request, STATE_COOKIE, state, 600);
export const clearStateCookie = (request) => cookieHeader(request, STATE_COOKIE, "", 0);
export const readState = (request) => readCookie(request, STATE_COOKIE);
