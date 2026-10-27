/* POST /api/notion/archive-country { pageId } — 刪除行程：把國家頁面移到 Notion 垃圾桶（可在 Notion 還原） */
import { withNotion } from "../../../lib/http.js";
import { archiveCountryPage, toNotionId } from "../../../lib/notion.js";

export const onRequestPost = (context) =>
  withNotion(context, (client, body) => archiveCountryPage(client, toNotionId(body.pageId)));
