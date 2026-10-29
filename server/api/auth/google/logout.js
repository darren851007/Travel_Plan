/* POST /api/auth/google/logout — 登出 Google 帳號（只刪這台裝置的 Cookie） */
import { checkPost, json } from "../../../../lib/http.js";
import { clearUserCookie } from "../../../../lib/session.js";

export async function onRequestPost({ request }) {
  const blocked = checkPost(request);
  if (blocked) return blocked;
  return json({ ok: true }, 200, { "Set-Cookie": clearUserCookie(request) });
}
