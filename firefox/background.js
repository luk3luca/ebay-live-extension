/* ============================================================
   eBay Live Clean - background
   Mantiene il badge dell'icona sincronizzato con lo stato.
   Dual-API: Chrome MV3 (chrome.action, service worker) e
   Firefox MV2 (browser.browserAction, script persistente).
   ============================================================ */

(function () {
  "use strict";

  var api = typeof browser !== "undefined" ? browser : chrome;
  var btn = api.action || api.browserAction;
  if (!btn) return;

  function updateBadge() {
    try {
      api.storage.local.get(["eblc_enabled"], function (d) {
        var on = !d || d.eblc_enabled !== false;
        btn.setBadgeText({ text: on ? "ON" : "" });
        btn.setBadgeBackgroundColor({ color: on ? "#16a34a" : "#666666" });
      });
    } catch (_) {}
  }

  try {
    if (api.runtime.onInstalled) api.runtime.onInstalled.addListener(updateBadge);
    if (api.runtime.onStartup) api.runtime.onStartup.addListener(updateBadge);
    api.storage.onChanged.addListener(function (changes, area) {
      if (area === "local" && changes.eblc_enabled) updateBadge();
    });
  } catch (_) {}

  updateBadge();
})();
