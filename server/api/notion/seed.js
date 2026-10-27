/* POST /api/notion/seed { tables, kind, offset, dest, config, order } — 把範例資料分批寫進一張表
   每次最多寫 BATCH 列，網頁會一直呼叫到寫完，避免單次請求太久或超過子請求上限 */
import { withNotion } from "../../../lib/http.js";
import { seedRows, createRows, toNotionId, TABLES, NotionError } from "../../../lib/notion.js";

const BATCH = 20;

export const onRequestPost = (context) =>
  withNotion(context, async (client, body) => {
    const { kind, dest, config } = body;
    if (!TABLES[kind] || !dest?.days || !config?.transports) throw new NotionError(400, "缺少範例資料");

    const rows = seedRows(dest, config, Number(body.order) || 1)[kind];
    const offset = Math.max(0, Number(body.offset) || 0);
    const batch = rows.slice(offset, offset + BATCH);
    if (batch.length) await createRows(client, toNotionId(body.tables?.[kind]), batch);

    return { created: batch.length, next: offset + batch.length, total: rows.length };
  });
