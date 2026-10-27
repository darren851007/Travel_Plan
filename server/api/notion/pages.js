/* GET /api/notion/pages — 使用者登入時分享的最上層頁面（從中選一個當作放國家頁面的上層頁面） */
import { withNotion } from "../../../lib/http.js";
import { listTopPages } from "../../../lib/notion.js";

export const onRequestGet = (context) => withNotion(context, (client) => listTopPages(client));
