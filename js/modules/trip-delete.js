/* ============================================================
   刪除行程（「我的旅行」卡片與行程頁共用）
   - 存在這台裝置的行程：直接刪除
   - Notion 同步的行程（需登入）：把國家頁面移到 Notion 垃圾桶，30 天內可在 Notion 還原
   內建範例不能刪除；按鈕都要按兩次才會刪除
   ============================================================ */
window.Trip = window.Trip || {};

Trip.tripDelete = {
  CONFIRM_MS: 4000,

  canDelete(dest) {
    return Boolean(dest?.local || (dest?.notionPageId && Trip.notionPanel?.status?.loggedIn));
  },

  label(dest) {
    return dest?.local ? "刪除" : "移到 Notion 垃圾桶";
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
