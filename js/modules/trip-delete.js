/* ============================================================
   刪除行程（「我的旅行」卡片與行程頁共用）
   - 存在這台裝置的行程：直接刪除（照片一起刪）
   - 共編行程：從我的清單離開，房間與其他人不受影響
   按鈕都要按兩次才會刪除
   ============================================================ */
window.Trip = window.Trip || {};

Trip.tripDelete = {
  CONFIRM_MS: 4000,

  canDelete(dest) {
    return Boolean(dest?.local || dest?.room);
  },

  label(dest) {
    return dest?.room ? "離開共編" : "刪除";
  },

  /* 第一次按：按鈕變成「確定刪除？」；時間內再按一次才真的刪除。回傳是否該刪了 */
  confirm(button, idleText) {
    if (!button.classList.contains("is-confirming")) {
      button.classList.add("is-confirming");
      button.textContent = "確定刪除？";
      clearTimeout(button._confirmTimer);
      button._confirmTimer = setTimeout(() => this.reset(button, idleText), this.CONFIRM_MS);
      return false;
    }
    this.reset(button, idleText);
    return true;
  },

  reset(button, idleText) {
    clearTimeout(button._confirmTimer);
    button.classList.remove("is-confirming");
    button.textContent = idleText;
  },

  /* 刪除並更新畫面；完成後回到「我的旅行」 */
  async remove(dest, button) {
    if (dest.room) {
      if (!Trip.rooms.remove(dest.room)) {
        Trip.addItem.toast("這個瀏覽器不允許儲存資料，無法離開");
        return false;
      }
      this.done(`已離開「${dest.title}」，其他人不受影響`);
      return true;
    }

    if (dest.local) {
      if (!Trip.localTrips.remove(dest.id)) {
        Trip.addItem.toast("刪除失敗：這個瀏覽器不允許儲存資料");
        return false;
      }
      Trip.photos.forget(dest);
      this.done(`已刪除「${dest.title}」`);
      return true;
    }

    return false;
  },

  done(message) {
    Trip.picker.render();
    if (location.hash !== "#/" && location.hash !== "") location.hash = "#/";
    Trip.addItem.toast(message);
  },
};
