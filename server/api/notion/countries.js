/* POST /api/notion/countries { parent } — 上層頁面底下的國家頁面清單 */
import { withNotion } from "../../../lib/http.js";
import { scanParent, toNotionId } from "../../../lib/notion.js";

export const onRequestPost = (context) =>
  withNotion(context, (client, body) => scanParent(client, toNotionId(body.parent)));
