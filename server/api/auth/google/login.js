/* GET /api/auth/google/login?back=#/… — 轉到 Google 登入頁；登入完回到 back 指的畫面 */
import { googleStateCookie, isGoogleConfigured, newState } from "../../../../lib/session.js";

/* 只接受站內的畫面網址（#/…），避免被拿來轉到別的網站 */
export const safeBack = (back) => (/^#\/[\w\-./%~]{0,300}$/.test(back || "") ? back : "");

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const back = safeBack(url.searchParams.get("back"));
  if (!isGoogleConfigured(env)) return Response.redirect(`${url.origin}/?login=not-configured${back}`, 302);

  const state = newState();
  const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorize.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", `${url.origin}/api/auth/google/callback`);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "openid email profile");
  authorize.searchParams.set("prompt", "select_account");
  authorize.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: { Location: authorize.toString(), "Set-Cookie": googleStateCookie(request, state, back), "Cache-Control": "no-store" },
  });
}
