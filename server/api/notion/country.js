/* POST /api/notion/country { page: {id, title}, config } — 讀一個國家頁面，轉成網頁行程
   一次只讀一個國家，避免超過 Cloudflare 免費方案單次請求的子請求上限 */
import { withNotion } from "../../../lib/http.js";
import { readCountry, toNotionId, NotionError } from "../../../lib/notion.js";

export const onRequestPost = (context) =>
  withNotion(context, (client, body) => {
    if (!body.config?.transports) throw new NotionError(400, "缺少網頁設定");
    const page = { id: toNotionId(body.page?.id), title: String(body.page?.title || "") };
    return readCountry(client, page, body.config);
  });
