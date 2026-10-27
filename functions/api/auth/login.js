/* GET /api/auth/login — 轉到 Notion 授權頁，讓使用者選擇要分享的頁面 */
import { isConfigured } from "../../../lib/http.js";
import { newState, stateCookie } from "../../../lib/session.js";

export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  if (!isConfigured(env)) return Response.redirect(`${origin}/?notion=not-configured`, 302);

  const state = newState();
  const authorize = new URL("https://api.notion.com/v1/oauth/authorize");
  authorize.searchParams.set("client_id", env.NOTION_CLIENT_ID);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("owner", "user");
  authorize.searchParams.set("redirect_uri", `${origin}/api/auth/callback`);
  authorize.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: { Location: authorize.toString(), "Set-Cookie": stateCookie(request, state), "Cache-Control": "no-store" },
  });
}
