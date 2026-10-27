/* POST /api/notion/row { op, table, pageId?, rowId?, values?, config } — 網頁上的新增／修改／刪除一列
   table：itinerary（景點）、flights、lodging、checklist、settings */
import { withNotion } from "../../../lib/http.js";
import { editRow, NotionError } from "../../../lib/notion.js";

export const onRequestPost = (context) =>
  withNotion(context, (client, body) => {
    if (!body.config?.transports) throw new NotionError(400, "缺少網頁設定");
    return editRow(client, body, body.config);
  });
