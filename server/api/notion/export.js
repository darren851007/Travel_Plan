/* 匯出行程到使用者自己的 Notion（分兩步，避免超過 Cloudflare 一次 50 個子請求的限制）
   POST /api/notion/export       { parent, trip }               建立行程頁面與 3 張空表，回傳表格 ID
   POST /api/notion/export-rows  { database, kind, rows（≤20）}  把資料分批寫進表格 */
import { withNotion } from "../../../lib/http.js";
import { createExportPage, addRows, toNotionId } from "../../../lib/notion.js";

export const onRequestPost = (context) =>
  withNotion(context, (client, body) => createExportPage(client, toNotionId(body.parent), body.trip));

export const onRowsPost = (context) =>
  withNotion(context, (client, body) => addRows(client, body.database, body.kind, body.rows));
