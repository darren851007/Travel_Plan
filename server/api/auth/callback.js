/* GET /api/auth/callback — Notion 授權完成後回到這裡，換取授權並存成加密 Cookie */
import { exchangeToken, isConfigured } from "../../../lib/http.js";
import { sessionCookie, readState, clearStateCookie } from "../../../lib/session.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const back = (result) => new Headers({ Location: `${url.origin}/?notion=${result}`, "Cache-Control": "no-store" });

  if (!isConfigured(env)) return new Response(null, { status: 302, headers: back("not-configured") });

  /* 使用者按了取消、或 state 不符（可能是偽造的回呼） */
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || state !== readState(request)) {
    const headers = back(url.searchParams.get("error") === "access_denied" ? "cancelled" : "error");
    headers.append("Set-Cookie", clearStateCookie(request));
    return new Response(null, { status: 302, headers });
  }

  try {
    const data = await exchangeToken(env, {
      grant_type: "authorization_code",
      code,
      redirect_uri: `${url.origin}/api/auth/callback`,
    });
    const headers = back("connected");
    headers.append("Set-Cookie", clearStateCookie(request));
    headers.append("Set-Cookie", await sessionCookie(request, env, {
      t: data.access_token,
      r: data.refresh_token || "",
      w: data.workspace_name || "",
      d: data.duplicated_template_id || "",
    }));
    return new Response(null, { status: 302, headers });
  } catch {
    const headers = back("error");
    headers.append("Set-Cookie", clearStateCookie(request));
    return new Response(null, { status: 302, headers });
  }
}
