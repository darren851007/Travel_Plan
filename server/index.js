/* ============================================================
   Cloudflare Worker 進入點：網頁檔案由 Static Assets 提供，/api/* 由這裡處理
   - Notion 登入與轉接：server/api/auth、server/api/notion
   - 共同編輯：server/api/rooms.js 與 server/room.js（Durable Object）
   ============================================================ */
import * as status from "./api/status.js";
import * as login from "./api/auth/login.js";
import * as callback from "./api/auth/callback.js";
import * as logout from "./api/auth/logout.js";
import * as pages from "./api/notion/pages.js";
import * as countries from "./api/notion/countries.js";
import * as country from "./api/notion/country.js";
import * as createCountry from "./api/notion/create-country.js";
import * as seed from "./api/notion/seed.js";
import * as row from "./api/notion/row.js";
import * as day from "./api/notion/day.js";
import * as archiveCountry from "./api/notion/archive-country.js";
import { createRoom, roomRequest } from "./api/rooms.js";
import { errorJson } from "../lib/http.js";

export { TripRoom } from "./room.js";

const routes = {
  "GET /api/status": status.onRequestGet,
  "GET /api/auth/login": login.onRequestGet,
  "GET /api/auth/callback": callback.onRequestGet,
  "POST /api/auth/logout": logout.onRequestPost,
  "GET /api/notion/pages": pages.onRequestGet,
  "POST /api/notion/countries": countries.onRequestPost,
  "POST /api/notion/country": country.onRequestPost,
  "POST /api/notion/create-country": createCountry.onRequestPost,
  "POST /api/notion/seed": seed.onRequestPost,
  "POST /api/notion/row": row.onRequestPost,
  "POST /api/notion/day": day.onRequestPost,
  "POST /api/notion/archive-country": archiveCountry.onRequestPost,
  "POST /api/rooms": createRoom,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const context = { request, env, ctx };

    const handler = routes[`${request.method} ${url.pathname}`];
    if (handler) return handler(context);

    const room = url.pathname.match(/^\/api\/rooms\/([^/]+)(\/ws)?$/);
    if (room && request.method === "GET") return roomRequest(context, room[1], Boolean(room[2]));

    if (url.pathname.startsWith("/api/")) return errorJson("找不到這個功能", 404);
    return env.ASSETS.fetch(request);
  },
};
