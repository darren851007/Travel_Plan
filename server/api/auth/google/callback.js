/* GET /api/auth/google/callback — Google 登入完成後回到這裡，取得帳號資料存成加密 Cookie */
import { clearGoogleStateCookie, isGoogleConfigured, readGoogleState, userCookie } from "../../../../lib/session.js";
import { safeBack } from "./login.js";

/* id_token 是直接從 Google 的 token 端點（HTTPS）拿到的，只需要解開內容並核對欄位 */
function readIdToken(token) {
  const part = String(token || "").split(".")[1] || "";
  const text = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(text, (c) => c.charCodeAt(0))));
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const saved = readGoogleState(request);
  const back = safeBack(saved?.back);
  const go = (result) => {
    const headers = new Headers({ Location: `${url.origin}/?login=${result}${back}`, "Cache-Control": "no-store" });
    headers.append("Set-Cookie", clearGoogleStateCookie(request));
    return headers;
  };

  if (!isGoogleConfigured(env)) return new Response(null, { status: 302, headers: go("not-configured") });

  /* 使用者按了取消、或 state 不符（可能是偽造的回呼） */
  const code = url.searchParams.get("code");
  if (!code || !saved?.state || url.searchParams.get("state") !== saved.state) {
    return new Response(null, { status: 302, headers: go(url.searchParams.get("error") === "access_denied" ? "cancelled" : "error") });
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${url.origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.id_token) throw new Error("Google 登入失敗");
    const claims = readIdToken(data.id_token);
    const issuer = ["https://accounts.google.com", "accounts.google.com"].includes(claims.iss);
    if (!issuer || claims.aud !== env.GOOGLE_CLIENT_ID || !claims.sub) throw new Error("Google 登入資料不正確");

    const headers = go("ok");
    headers.append(
      "Set-Cookie",
      await userCookie(request, env, {
        id: String(claims.sub),
        name: String(claims.name || claims.email || "").slice(0, 60),
        email: String(claims.email || "").slice(0, 120),
      })
    );
    return new Response(null, { status: 302, headers });
  } catch {
    return new Response(null, { status: 302, headers: go("error") });
  }
}
