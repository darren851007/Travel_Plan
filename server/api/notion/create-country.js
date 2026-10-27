/* POST /api/notion/create-country { parent, dest, config } — 建立一個範例國家頁面與 5 張空表 */
import { withNotion } from "../../../lib/http.js";
import { createCountryPage, toNotionId, NotionError } from "../../../lib/notion.js";

export const onRequestPost = (context) =>
  withNotion(context, (client, body) => {
    if (!body.dest?.name || !body.config?.transports) throw new NotionError(400, "缺少範例資料");
    return createCountryPage(client, toNotionId(body.parent), body.dest, body.config);
  });
