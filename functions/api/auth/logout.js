/* POST /api/auth/logout — 刪除這台裝置上的登入 Cookie（Notion 裡的資料不受影響） */
import { checkPost, json } from "../../../lib/http.js";
import { clearSessionCookie } from "../../../lib/session.js";

export async function onRequestPost({ request }) {
  const blocked = checkPost(request);
  if (blocked) return blocked;
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie(request) });
}
