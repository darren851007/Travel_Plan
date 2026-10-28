/* ============================================================
   行程照片：整趟行程的封面、每個景點的照片
   - 選照片後先在瀏覽器縮小、壓成 JPEG（最長邊 1600 像素），再儲存
   - 存在這台裝置的行程：照片存在這台裝置的瀏覽器（IndexedDB），不會上傳
   - 共編行程：上傳到共編房間，一起編輯的人都看得到
   行程裡的 cover（封面）、景點的 photo：「dev:<id>」＝這台裝置的照片、「room:<id>」＝共編房間的照片
   target：「cover」＝封面，其他＝景點的 uid
   分享連結（唯讀）不包含照片
   ============================================================ */
window.Trip = window.Trip || {};

Trip.photos = {
  DB: "trip-photos",
  STORE: "photos",
  MAX_SIDE: 1600,
  MAX_BYTES: 1_400_000,
  MAX_INPUT: 30_000_000,
  urls: new Map(),

  /* ---------- 照片處理 ---------- */

  /* 讀取使用者選的檔案，縮小並壓成 JPEG；讀不到時丟出中文錯誤 */
  async prepare(file) {
    if (!file || !/^image\//.test(file.type || "image/")) throw new Error("請選擇照片檔案（JPG、PNG、HEIC 等）");
    if (file.size > this.MAX_INPUT) throw new Error("照片太大了，請選 30MB 以下的照片");
    const image = await this.decode(file);
    for (const [side, quality] of [[this.MAX_SIDE, 0.82], [1280, 0.75], [1024, 0.7]]) {
      const blob = await this.resize(image, side, quality);
      if (blob.size <= this.MAX_BYTES) return blob;
    }
    throw new Error("照片壓縮後還是太大，請換一張");
  },

  async decode(file) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* 舊瀏覽器：改用 <img> 讀 */
      const url = URL.createObjectURL(file);
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        return img;
      } catch {
        throw new Error("這個瀏覽器讀不了這種照片格式，請改用 JPG 或 PNG");
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  },

  resize(image, maxSide, quality) {
    const w = image.width || image.naturalWidth;
    const h = image.height || image.naturalHeight;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fffcf6"; /* 透明背景的 PNG 轉 JPEG 時用和紙白 */
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("照片處理失敗，請換一張"))), "image/jpeg", quality)
    );
  },

  /* ---------- 這台裝置的照片（IndexedDB） ---------- */

  open() {
    this.db ||= new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(this.STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error("這個瀏覽器不允許儲存照片（例如無痕模式）"));
    });
    return this.db;
  },

  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(this.STORE, mode);
      const req = fn(t.objectStore(this.STORE));
      t.oncomplete = () => resolve(req?.result);
      t.onerror = () => reject(t.error || new Error("照片儲存失敗"));
      t.onabort = () => reject(t.error || new Error("照片儲存失敗（空間可能不足）"));
    });
  },

  async putLocal(blob) {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    await this.tx("readwrite", (s) => s.put(blob, id));
    return `dev:${id}`;
  },

  async removeLocal(cover) {
    if (!cover?.startsWith("dev:")) return;
    const id = cover.slice(4);
    const url = this.urls.get(id);
    if (url) URL.revokeObjectURL(url);
    this.urls.delete(id);
    try {
      await this.tx("readwrite", (s) => s.delete(id));
    } catch {
      /* 刪不掉也沒關係 */
    }
  },

  /* ---------- 行程的封面與景點照片 ---------- */

  findItem(dest, uid) {
    for (const day of dest?.days || []) {
      const item = (day.items || []).find((i) => i.uid === uid);
      if (item) return item;
    }
    return null;
  },

  photoOf(dest, target = "cover") {
    if (!dest) return null;
    const ref = target === "cover" ? dest.cover : this.findItem(dest, target)?.photo;
    return typeof ref === "string" ? ref : null;
  },

  coverOf(dest) {
    return this.photoOf(dest, "cover");
  },

  /* 照片網址（沒有照片或讀不到時回傳 null） */
  async url(dest, target = "cover") {
    const cover = this.photoOf(dest, target);
    if (!cover) return null;
    const room = cover.match(/^room:([A-Za-z0-9_-]{1,40})$/);
    if (room) return dest.room ? `/api/rooms/${encodeURIComponent(dest.room)}/photos/${room[1]}` : null;
    if (!cover.startsWith("dev:")) return null;
    const id = cover.slice(4);
    if (this.urls.has(id)) return this.urls.get(id);
    try {
      const blob = await this.tx("readonly", (s) => s.get(id));
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      this.urls.set(id, url);
      return url;
    } catch {
      return null;
    }
  },

  setCover(dest, blob) {
    return this.setPhoto(dest, "cover", blob);
  },

  /* 換照片（blob＝null 表示移除）；完成後由呼叫的地方重畫畫面 */
  async setPhoto(dest, target, blob) {
    if (dest.room) return this.setRoomPhoto(dest, target, blob);

    const old = this.photoOf(dest, target);
    const cover = blob ? await this.putLocal(blob) : null;
    if (dest.local) {
      const apply = (d) => {
        const holder = target === "cover" ? d : this.findItem(d, target);
        if (!holder) return;
        if (target === "cover") holder.cover = cover;
        else if (cover) holder.photo = cover;
        else delete holder.photo;
      };
      if (!Trip.localTrips.update(dest.id, apply)) {
        await this.removeLocal(cover);
        throw new Error("這個瀏覽器不允許儲存資料（例如無痕模式）");
      }
    } else {
      await this.removeLocal(cover);
      throw new Error("這趟行程不能加照片");
    }
    if (old !== cover) await this.removeLocal(old);
  },

  setRoomCover(dest, blob) {
    return this.setRoomPhoto(dest, "cover", blob);
  },

  /* 共編：上傳到房間，房間會通知所有人更新 */
  async setRoomPhoto(dest, target, blob) {
    const res = await fetch(`/api/rooms/${encodeURIComponent(dest.room)}/photos?target=${encodeURIComponent(target)}`, {
      method: blob ? "POST" : "DELETE",
      credentials: "same-origin",
      headers: { "Content-Type": blob ? blob.type : "application/json", "X-Trip-Name": encodeURIComponent(Trip.collab.myName()) },
      body: blob || undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "照片上傳失敗，請稍後再試");
    Trip.rooms.receive(dest.room, data.version, data.trip);
  },

  /* 這台裝置的行程刪除時，一併刪掉所有照片 */
  forget(dest) {
    if (!dest?.local) return;
    this.removeLocal(dest.cover);
    for (const day of dest.days || []) for (const item of day.items || []) this.removeLocal(item.photo);
  },

  /* 景點刪除後：這台裝置的照片一併刪掉（共編房間會自己清） */
  dropItem(dest, uid, ref) {
    this.removeLocal(ref);
  },

  /* ---------- 對話框裡的照片欄位 ---------- */

  /* 在 container 裡放一個照片欄位；回傳 { state() → { changed, blob } } */
  field(container, currentUrl, alt = "封面照片預覽") {
    container.innerHTML = `
<div class="photo-field">
  <div class="photo-field__preview">
    <img alt="${Trip.utils.esc(alt)}" hidden>
    <span class="photo-field__empty">還沒有照片</span>
  </div>
  <div class="photo-field__actions">
    <button class="btn btn--ghost btn--small" type="button" data-photo="pick">選擇照片</button>
    <button class="btn btn--ghost btn--small" type="button" data-photo="remove">移除照片</button>
    <input class="visually-hidden" type="file" accept="image/*" tabindex="-1" aria-hidden="true">
  </div>
  <span class="field__hint photo-field__hint">會自動縮小後儲存</span>
</div>`;
    const img = container.querySelector("img");
    const empty = container.querySelector(".photo-field__empty");
    const input = container.querySelector("input[type=file]");
    const removeButton = container.querySelector('[data-photo="remove"]');
    const pickButton = container.querySelector('[data-photo="pick"]');
    const hint = container.querySelector(".photo-field__hint");
    const state = { changed: false, blob: null, busy: false };
    let preview = null;

    const show = (url) => {
      img.hidden = !url;
      empty.hidden = Boolean(url);
      if (url) img.src = url;
      else img.removeAttribute("src");
      removeButton.hidden = !url;
      pickButton.textContent = url ? "換一張" : "選擇照片";
    };
    show(currentUrl);

    pickButton.addEventListener("click", () => input.click());
    removeButton.addEventListener("click", () => {
      Object.assign(state, { changed: true, blob: null });
      show(null);
      hint.textContent = "儲存後會移除照片";
    });
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;
      state.busy = true;
      hint.textContent = "處理照片中…";
      try {
        const blob = await this.prepare(file);
        if (preview) URL.revokeObjectURL(preview);
        preview = URL.createObjectURL(blob);
        Object.assign(state, { changed: true, blob });
        show(preview);
        hint.textContent = `已選好照片（${Math.round(blob.size / 1024)} KB），按儲存後生效`;
      } catch (err) {
        hint.textContent = err.message;
      } finally {
        state.busy = false;
      }
    });
    return { state: () => state };
  },
};
