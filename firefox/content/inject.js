/* ============================================================
   eBay Live Clean - content script
   ------------------------------------------------------------
   Solo gestione stato: aggiunge/toglie "eblc-on" su <html>
   del proprio frame (pagina, wrapper player, video player)
   e imposta la variabile --eblc-sidebar (larghezza colonna).
   Nessuna manipolazione del DOM: il layout e' tutto in CSS,
   con selettori sui PREFISSI di classe (stabili tra i redeploy),
   mai sugli hash.
   ============================================================ */

(function () {
  "use strict";

  var STORAGE_KEY = "eblc_enabled";
  var WIDTH_KEY = "eblc_width";
  var CLASS_ON = "eblc-on";
  var CLASS_OFF = "eblc-off";

  function getStorage() {
    if (typeof browser !== "undefined" && browser.storage) return browser.storage;
    if (typeof chrome !== "undefined" && chrome.storage) return chrome.storage;
    return null;
  }

  function applyState(enabled) {
    var root = document.documentElement;
    if (!root) return;
    root.classList.toggle(CLASS_ON, !!enabled);
    root.classList.toggle(CLASS_OFF, !enabled);
  }

  function applyWidth(px) {
    var n = parseInt(px, 10);
    if (!isFinite(n)) return;
    var root = document.documentElement;
    if (!root) return;
    root.style.setProperty("--eblc-sidebar", n + "px");
  }

  function handleData(data) {
    data = data || {};
    applyState(data[STORAGE_KEY] !== false);
    if (data[WIDTH_KEY]) applyWidth(data[WIDTH_KEY]);
  }

  function readStateAndApply() {
    var storage = getStorage();
    if (!storage || !storage.local) { applyState(true); return; }
    try {
      var p = storage.local.get([STORAGE_KEY, WIDTH_KEY]);
      if (p && typeof p.then === "function") {
        p.then(handleData, function () { applyState(true); });
      } else {
        // callback-style (Firefox compat)
        storage.local.get([STORAGE_KEY, WIDTH_KEY], handleData);
      }
    } catch (_) {
      applyState(true);
    }
  }

  function handleMessage(msg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "EBLC_TOGGLE") {
      applyState(!!msg.enabled);
      var storage = getStorage();
      if (storage && storage.local) {
        try { storage.local.set({ eblc_enabled: !!msg.enabled }); } catch (_) {}
      }
    }
  }

  try {
    var api = typeof browser !== "undefined" ? browser : chrome;
    if (api && api.runtime && api.runtime.onMessage) {
      api.runtime.onMessage.addListener(handleMessage);
    }
    var storage = getStorage();
    if (storage && storage.onChanged) {
      storage.onChanged.addListener(function (changes, area) {
        if (area !== "local") return;
        if (changes[STORAGE_KEY]) {
          var nv = changes[STORAGE_KEY].newValue;
          applyState(nv === undefined ? true : !!nv);
        }
        if (changes[WIDTH_KEY] && changes[WIDTH_KEY].newValue) {
          applyWidth(changes[WIDTH_KEY].newValue);
        }
      });
    }
  } catch (_) {}

  // applicazione iniziale + ri-applicazione dopo SPA re-render:
  // basta rimettere la classe su <html>, il CSS fa il resto.
  function boot() {
    readStateAndApply();
    try {
      var scheduled = false;
      new MutationObserver(function () {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(function () {
          scheduled = false;
          if (!document.documentElement.classList.contains(CLASS_ON)) {
            // eBay puo' ripulire le classi di <html>: se manca, la rimettiamo
            readStateAndApply();
          }
        });
      }).observe(document.documentElement, { attributes: true, childList: true, subtree: false });
    } catch (_) {}
  }

  if (document.documentElement) boot();
  else document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
