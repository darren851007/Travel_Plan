/* ============================================================
   擁有者的收件匣（Cloudflare Durable Object，每個 Google 帳號一個）
   存放別人的申請，等擁有者打開那趟行程時跳出對話框決定：
   - join：好友打開「分享給好友」的唯讀連結，按「加入我的行程」
   - edit：共編裡只能看的成員按「申請一起編輯」
   tripRef：申請的是哪一趟（共編行程是房間代號，只存在擁有者裝置的行程是那台裝置上的 ID）
   只由 server/api/shares.js、server/api/rooms.js 呼叫，瀏覽器碰不到
   ============================================================ */
import { DurableObject } from "cloudflare:workers";

const MAX_PENDING = 100;
const MAX_KEPT = 300;

export class OwnerInbox extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    const requests = (await this.ctx.storage.get("requests")) || {};
    const pending = Object.entries(requests)
      .filter(([, r]) => r.status === "pending")
      .map(([id, r]) => ({ id, ...r }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    if (url.pathname === "/list") return Response.json({ requests: pending });

    if (url.pathname === "/get") {
      const found = requests[body.id];
      return found ? Response.json({ id: body.id, ...found }) : Response.json({ error: "找不到這個申請" }, { status: 404 });
    }

    /* 新申請：同一個人對同一趟還在等的申請只留一筆 */
    if (url.pathname === "/add") {
      const same = pending.find((r) => r.requester.id === body.requester?.id && r.tripRef === body.tripRef && r.kind === body.kind);
      if (same) return Response.json(same);
      if (pending.length >= MAX_PENDING) return Response.json({ error: "擁有者還有太多申請沒處理，請稍後再試" }, { status: 429 });
      const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      requests[id] = {
        kind: body.kind === "edit" ? "edit" : "join",
        tripRef: String(body.tripRef || "").slice(0, 100),
        title: String(body.title || "").slice(0, 100),
        requester: body.requester,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      /* 處理過的舊申請太多就刪掉最舊的 */
      const ids = Object.keys(requests);
      if (ids.length > MAX_KEPT) {
        ids
          .filter((k) => requests[k].status !== "pending")
          .sort((a, b) => requests[a].createdAt.localeCompare(requests[b].createdAt))
          .slice(0, ids.length - MAX_KEPT)
          .forEach((k) => delete requests[k]);
      }
      await this.ctx.storage.put("requests", requests);
      return Response.json({ id, ...requests[id] });
    }

    /* 申請的人自己取消（requesterIds：這個瀏覽器的身分，要包含當初申請的人） */
    if (url.pathname === "/cancel") {
      const found = requests[body.id];
      const ids = Array.isArray(body.requesterIds) ? body.requesterIds : [];
      if (!found || !ids.includes(found.requester?.id)) return Response.json({ error: "找不到這個申請" }, { status: 404 });
      if (found.status === "pending") {
        found.status = "cancelled";
        found.resolvedAt = new Date().toISOString();
        await this.ctx.storage.put("requests", requests);
      }
      return Response.json({ id: body.id, ...found });
    }

    /* 同意（記下加入的共編房間）或拒絕 */
    if (url.pathname === "/resolve") {
      const found = requests[body.id];
      if (!found || found.status !== "pending") return Response.json({ error: "這個申請已經處理過了" }, { status: 409 });
      found.status = body.approve ? "approved" : "declined";
      found.resolvedAt = new Date().toISOString();
      if (body.approve) found.roomId = body.roomId;
      await this.ctx.storage.put("requests", requests);
      return Response.json({ id: body.id, ...found });
    }

    return Response.json({ error: "找不到這個功能" }, { status: 404 });
  }
}
