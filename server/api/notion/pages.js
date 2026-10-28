/* GET /api/notion/pages — 使用者登入時分享的最上層頁面（匯出時從中選一個放行程） */
import { withNotion } from "../../../lib/http.js";
import { listTopPages } from "../../../lib/notion.js";

export const onRequestGet = (context) => withNotion(context, (client) => listTopPages(client));
