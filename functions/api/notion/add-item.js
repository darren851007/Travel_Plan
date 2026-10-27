/* POST /api/notion/add-item { pageId, item, config } — 網頁對話框新增的一筆行程，寫進該國家頁面的「行程」表 */
import { withNotion } from "../../../lib/http.js";
import { addItineraryItem, toNotionId, NotionError } from "../../../lib/notion.js";

export const onRequestPost = (context) =>
  withNotion(context, (client, body) => {
    if (!body.config?.transports) throw new NotionError(400, "缺少網頁設定");
    return addItineraryItem(client, toNotionId(body.pageId), body.item, body.config);
  });
