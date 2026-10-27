/* ============================================================
   刪除行程（「我的旅行」卡片與行程頁共用）
   - 存在這台裝置的行程：直接刪除
   - 內建範例：在這台裝置隱藏，「我的旅行」頁可以還原
   - Notion 同步的行程（需登入）：把國家頁面移到 Notion 垃圾桶，30 天內可在 Notion 還原
   按鈕都要按兩次才會刪除
   ============================================================ */
window.Trip = window.Trip || {};

Trip.tripDelete = {
  CONFIRM_MS: 4000,

  canDelete(dest) {
    return Boolean(
      dest?.local || dest?.room || Trip.localTrips.isSample(dest) || (dest?.notionPageId && Trip.notionPanel?.status?.loggedIn)
    );
  },

  /* Notion 的行程是移到垃圾桶；其他都在這台裝置刪除 */
  label(dest) {
    if (dest?.room) return "離開共編";
    return dest?.notionPageId ? "移到 Notion 垃圾桶" : "刪除";
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

    if (Trip.localTrips.isSample(dest)) {
      if (!Trip.localTrips.hideSample(dest.id)) {
        Trip.addItem.toast("刪除失敗：這個瀏覽器不允許儲存資料");
        return false;
      }
      this.done(`已刪除「${dest.title}」，可以在「我的旅行」頁還原範例`);
      return true;
    }

    if (dest.local) {
      if (!Trip.localTrips.remove(dest.id)) {
        Trip.addItem.toast("刪除失敗：這個瀏覽器不允許儲存資料");
        return false;
      }
      this.done(`已刪除「${dest.title}」`);
      return true;
    }

    if (button) {
      button.disabled = true;
      button.textContent = "刪除中…";
    }
    try {
      await Trip.notionPanel.request("POST", "notion/archive-country", { pageId: dest.notionPageId });
    } catch (err) {
      if (button) {
        button.disabled = false;
        this.reset(button, this.label(dest));
      }
      Trip.addItem.toast(err.status === 401 ? "Notion 登入已過期，請重新登入" : `刪除失敗：${err.message}`);
      return false;
    }

    /* 從畫面與瀏覽器快取移除，不用重新同步 */
    Trip.destinations = Trip.destinations.filter((d) => d.id !== dest.id);
    const cache = Trip.notionCache.load();
    if (cache?.destinations) {
      cache.destinations = cache.destinations.filter((d) => d.id !== dest.id);
      Trip.notionCache.save(cache);
    }
    const panel = Trip.notionPanel;
    if (panel.scan) panel.scan.countries = panel.scan.countries.filter((c) => c.id !== dest.notionPageId);
    this.done(`已把「${dest.title}」移到 Notion 垃圾桶`);
    return true;
  },

  done(message) {
    Trip.picker.render();
    if (location.hash !== "#/" && location.hash !== "") location.hash = "#/";
    Trip.addItem.toast(message);
  },
};
