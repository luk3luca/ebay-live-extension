/* ============================================================
   eBay Live Clean - popup script
   - reads/writes browser.storage.local.eblc_enabled
   - sends EBLC_TOGGLE message to all frames in the active tab
   ============================================================ */

(function () {
  "use strict";

  const STORAGE_KEY = "eblc_enabled";

  function api() {
    return typeof browser !== "undefined" ? browser : chrome;
  }

  function storage() {
    const a = api();
    return a && a.storage && a.storage.local ? a.storage.local : null;
  }

  function tabs() {
    const a = api();
    return a && a.tabs ? a.tabs : null;
  }

  function runtime() {
    const a = api();
    return a && a.runtime ? a.runtime : null;
  }

  function setStatus(text, ok) {
    const el = document.getElementById("status");
    if (!el) return;
    el.textContent = text;
    el.style.color = ok === false ? "#f87171" : "#4ade80";
  }

  function getEnabled() {
    return new Promise((resolve) => {
      const s = storage();
      if (!s) return resolve(true);
      try {
        const p = s.get(STORAGE_KEY);
        if (p && typeof p.then === "function") {
          p.then((d) => resolve(!d || d[STORAGE_KEY] !== false), () => resolve(true));
        } else {
          s.get(STORAGE_KEY, (d) => resolve(!d || d[STORAGE_KEY] !== false));
        }
      } catch (_) {
        resolve(true);
      }
    });
  }

  function setEnabled(value) {
    return new Promise((resolve) => {
      const s = storage();
      if (!s) return resolve();
      try {
        const p = s.set({ [STORAGE_KEY]: !!value });
        if (p && typeof p.then === "function") p.then(resolve, resolve);
        else resolve();
      } catch (_) {
        resolve();
      }
    });
  }

  function broadcastToggle(enabled) {
    const t = tabs();
    const r = runtime();
    if (!t || !r) return Promise.resolve();

    return new Promise((resolve) => {
      try {
        t.query({ active: true, currentWindow: true }, (tabsList) => {
          if (!tabsList || !tabsList[0]) return resolve();
          const tabId = tabsList[0].id;
          try {
            r.sendMessage(
              tabId,
              { type: "EBLC_TOGGLE", enabled: !!enabled },
              { frameId: 0 },
              () => void chrome.runtime.lastError
            );
          } catch (_) { /* ignore */ }
          // also broadcast to all sub-frames
          try {
            r.sendMessage(
              tabId,
              { type: "EBLC_TOGGLE", enabled: !!enabled },
              () => void chrome.runtime.lastError
            );
          } catch (_) { /* ignore */ }
          resolve();
        });
      } catch (_) {
        resolve();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const toggle = document.getElementById("toggle");
    if (!toggle) return;

    const current = await getEnabled();
    toggle.checked = current !== false;

    toggle.addEventListener("change", async () => {
      const enabled = !!toggle.checked;
      setStatus(enabled ? "Attivato" : "Disattivato");
      await setEnabled(enabled);
      await broadcastToggle(enabled);
    });

    setStatus(toggle.checked ? "Attivo" : "Disattivato");
  });
})();
