/* ============================================================
   Cloudflare Worker 進入點：網頁檔案由 Static Assets 提供，/api/* 由這裡處理
   - 匯出至 Notion：server/api/auth（Notion 登入）、server/api/notion（選頁面、建立匯出頁面）
   - 共同編輯：server/api/rooms.js 與 server/room.js（Durable Object）
   - 查詢真實航班：server/api/flights.js（AeroDataBox）
   ============================================================ */
import * as status from "./api/status.js";
import * as login from "./api/auth/login.js";
import * as callback from "./api/auth/callback.js";
import * as logout from "./api/auth/logout.js";
import * as pages from "./api/notion/pages.js";
import * as notionExport from "./api/notion/export.js";
import { createRoom, roomRequest } from "./api/rooms.js";
import { lookup as flightLookup } from "./api/flights.js";
import { errorJson } from "../lib/http.js";

export { TripRoom } from "./room.js";

const routes = {
  "GET /api/status": status.onRequestGet,
  "GET /api/auth/login": login.onRequestGet,
  "GET /api/auth/callback": callback.onRequestGet,
  "POST /api/auth/logout": logout.onRequestPost,
  "GET /api/notion/pages": pages.onRequestGet,
  "POST /api/notion/export": notionExport.onRequestPost,
  "POST /api/notion/export-rows": notionExport.onRowsPost,
  "POST /api/rooms": createRoom,
  "POST /api/flights/lookup": flightLookup,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const context = { request, env, ctx };

    const handler = routes[`${request.method} ${url.pathname}`];
    if (handler) return handler(context);

    const room = url.pathname.match(/^\/api\/rooms\/([^/]+)(\/ws)?$/);
    if (room && request.method === "GET") return roomRequest(context, room[1], Boolean(room[2]));
    const cover = url.pathname.match(/^\/api\/rooms\/([^/]+)\/(cover|photos)$/);
    if (cover && (request.method === "POST" || request.method === "DELETE")) return roomRequest(context, cover[1], false);
    const photo = url.pathname.match(/^\/api\/rooms\/([^/]+)\/photos\/[^/]+$/);
    if (photo && request.method === "GET") return roomRequest(context, photo[1], false);

    if (url.pathname.startsWith("/api/")) return errorJson("找不到這個功能", 404);
    return env.ASSETS.fetch(request);
  },
};
