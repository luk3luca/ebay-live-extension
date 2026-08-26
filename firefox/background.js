/* ============================================================
   eBay Live Clean - service worker (MV3)
   Keeps the toolbar badge in sync with the enabled state.
   ============================================================ */

function updateBadge() {
  try {
    chrome.storage.local.get(["eblc_enabled"], function (d) {
      var on = !d || d.eblc_enabled !== false;
      chrome.action.setBadgeText({ text: on ? "ON" : "" });
      chrome.action.setBadgeBackgroundColor({ color: on ? "#16a34a" : "#666666" });
    });
  } catch (_) {}
}

chrome.runtime.onInstalled.addListener(updateBadge);
chrome.runtime.onStartup.addListener(updateBadge);

try {
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === "local" && changes.eblc_enabled) updateBadge();
  });
} catch (_) {}

updateBadge();
