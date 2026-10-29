/* GET /api/status — 網站是否已設定 Notion 登入、目前使用者是否已登入、是否開啟共同編輯、航班查詢
   google：是否能用 Google 登入；user：目前登入的 Google 帳號；guest：在這個瀏覽器以訪客加入過共編時的名字 */
import { json, isConfigured } from "../../lib/http.js";
import { getGuest, getSession, getUser, isGoogleConfigured } from "../../lib/session.js";

export async function onRequestGet({ request, env }) {
  const configured = isConfigured(env);
  const session = configured ? await getSession(request, env) : null;
  const user = await getUser(request, env);
  const guest = await getGuest(request, env);
  return json({
    configured,
    loggedIn: Boolean(session?.t),
    workspace: session?.w || "",
    templatePage: session?.d || "",
    collab: Boolean(env.TRIP_ROOM),
    google: isGoogleConfigured(env),
    places: Boolean(env.PLACES_DB),
    user: user ? { id: user.id, name: user.name, email: user.email } : null,
    guest: guest ? { name: guest.name } : null,
    flightLookup: Boolean(env.AERODATABOX_KEY),
  });
}
