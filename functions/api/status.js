/* GET /api/status — 網站是否已設定 Notion 登入、目前使用者是否已登入 */
import { json, isConfigured } from "../../lib/http.js";
import { getSession } from "../../lib/session.js";

export async function onRequestGet({ request, env }) {
  const configured = isConfigured(env);
  const session = configured ? await getSession(request, env) : null;
  return json({
    configured,
    loggedIn: Boolean(session?.t),
    workspace: session?.w || "",
    templatePage: session?.d || "",
  });
}
