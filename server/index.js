/* ============================================================
   Cloudflare Worker 進入點：網頁檔案由 Static Assets 提供，/api/* 由這裡處理
   - 匯出至 Notion：server/api/auth（Notion 登入）、server/api/notion（選頁面、建立匯出頁面）
   - Google 登入：server/api/auth/google（共編行程的擁有者與受邀成員）
   - 共同編輯：server/api/rooms.js 與 server/room.js（Durable Object）
   - 分享的申請與擁有者的收件匣：server/api/shares.js 與 server/inbox.js（Durable Object）
   - 國家與城市：server/api/places.js 查 D1；排程（scheduled）每月向 GeoNames 更新一次（server/places.js）
   - 查詢真實航班：server/api/flights.js（AeroDataBox）
   ============================================================ */
import * as status from "./api/status.js";
import * as login from "./api/auth/login.js";
import * as callback from "./api/auth/callback.js";
import * as logout from "./api/auth/logout.js";
import * as googleLogin from "./api/auth/google/login.js";
import * as googleCallback from "./api/auth/google/callback.js";
import * as googleLogout from "./api/auth/google/logout.js";
import * as pages from "./api/notion/pages.js";
import * as notionExport from "./api/notion/export.js";
import { createRoom, roomRequest } from "./api/rooms.js";
import * as shares from "./api/shares.js";
import * as places from "./api/places.js";
import { syncStep } from "./places.js";
import { lookup as flightLookup } from "./api/flights.js";
import { errorJson } from "../lib/http.js";

export { TripRoom } from "./room.js";
export { OwnerInbox } from "./inbox.js";

const routes = {
  "GET /api/status": status.onRequestGet,
  "GET /api/auth/login": login.onRequestGet,
  "GET /api/auth/callback": callback.onRequestGet,
  "POST /api/auth/logout": logout.onRequestPost,
  "GET /api/auth/google/login": googleLogin.onRequestGet,
  "GET /api/auth/google/callback": googleCallback.onRequestGet,
  "POST /api/auth/google/logout": googleLogout.onRequestPost,
  "GET /api/notion/pages": pages.onRequestGet,
  "POST /api/notion/export": notionExport.onRequestPost,
  "POST /api/notion/export-rows": notionExport.onRowsPost,
  "POST /api/rooms": createRoom,
  "POST /api/shares": shares.createShare,
  "POST /api/shares/request": shares.requestJoin,
  "POST /api/shares/status": shares.requestStatus,
  "POST /api/shares/cancel": shares.cancelRequest,
  "GET /api/inbox": shares.listInbox,
  "POST /api/inbox/resolve": shares.resolve,
  "POST /api/flights/lookup": flightLookup,
  "GET /api/places/countries": places.countries,
  "GET /api/places/cities": places.cities,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const context = { request, env, ctx };

    const handler = routes[`${request.method} ${url.pathname}`];
    if (handler) return handler(context);

    const room = url.pathname.match(/^\/api\/rooms\/([^/]+)(\/ws)?$/);
    if (room && request.method === "GET") return roomRequest(context, room[1], room[2] ? "ws" : "read");
    const api = url.pathname.match(/^\/api\/rooms\/([^/]+)\/(join|access|ask)$/);
    if (api && (request.method === "POST" || (api[2] === "access" && request.method === "GET"))) {
      return roomRequest(context, api[1], "api");
    }
    const cover = url.pathname.match(/^\/api\/rooms\/([^/]+)\/(cover|photos)$/);
    if (cover && (request.method === "POST" || request.method === "DELETE")) return roomRequest(context, cover[1], "photo");
    const photo = url.pathname.match(/^\/api\/rooms\/([^/]+)\/photos\/[^/]+$/);
    if (photo && request.method === "GET") return roomRequest(context, photo[1], "read");

    if (url.pathname.startsWith("/api/")) return errorJson("找不到這個功能", 404);
    return env.ASSETS.fetch(request);
  },

  /* 排程：每月更新國家、城市、機場（每次一小步，見 server/places.js） */
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      syncStep(env)
        .then((done) => console.log(`places sync: ${done}`))
        .catch((err) => console.error("places sync failed", err))
    );
  },
};
