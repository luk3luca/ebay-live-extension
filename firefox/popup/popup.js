/* ============================================================
   eBay Live Clean - popup script (Chrome MV3)
   - reads/writes chrome.storage.local: eblc_enabled, eblc_width
   - changes propagate by themselves to every open frame
     (content scripts listen to storage.onChanged)
   ============================================================ */

(function () {
  "use strict";

  var KEY_ENABLED = "eblc_enabled";
  var KEY_WIDTH = "eblc_width";

  function get(keys) {
    return new Promise(function (resolve) {
      try {
        var p = chrome.storage.local.get(keys);
        if (p && typeof p.then === "function") p.then(resolve, function () { resolve({}); });
        else chrome.storage.local.get(keys, resolve);
      } catch (_) { resolve({}); }
    });
  }

  function set(obj) {
    return new Promise(function (resolve) {
      try {
        var p = chrome.storage.local.set(obj);
        if (p && typeof p.then === "function") p.then(resolve, resolve);
        else chrome.storage.local.set(obj, resolve);
      } catch (_) { resolve(); }
    });
  }

  function setStatus(text, ok) {
    var el = document.getElementById("status");
    if (!el) return;
    el.textContent = text;
    el.style.color = ok === false ? "#f87171" : "#4ade80";
  }

  document.addEventListener("DOMContentLoaded", function () {
    var toggle = document.getElementById("toggle");
    var width = document.getElementById("width");
    var wval = document.getElementById("wval");
    if (!toggle || !width) return;

    get([KEY_ENABLED, KEY_WIDTH]).then(function (data) {
      toggle.checked = !data || data[KEY_ENABLED] !== false;
      var w = (data && data[KEY_WIDTH]) || 360;
      width.value = String(w);
      if (wval) wval.textContent = w + "px";
      setStatus(toggle.checked ? "Active" : "Disabled");
    });

    toggle.addEventListener("change", function () {
      setStatus(toggle.checked ? "Enabled" : "Disabled");
      set({ eblc_enabled: !!toggle.checked });
    });

    width.addEventListener("input", function () {
      var w = parseInt(width.value, 10);
      if (!isFinite(w)) return;
      if (wval) wval.textContent = w + "px";
      set({ eblc_width: w });
    });
  });
})();
