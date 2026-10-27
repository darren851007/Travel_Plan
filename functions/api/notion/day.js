/* POST /api/notion/day { rowIds, theme, city } — 編輯一整天的主題與城市 */
import { withNotion } from "../../../lib/http.js";
import { editDay } from "../../../lib/notion.js";

export const onRequestPost = (context) => withNotion(context, (client, body) => editDay(client, body));
