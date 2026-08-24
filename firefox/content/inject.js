/* ============================================================
   eBay Live Clean - content script
   ------------------------------------------------------------
   Responsibilities:
     1. read the enabled flag from browser.storage.local
     2. toggle the "eblc-on" class on <html> in the current
        frame (page or iframe, both have all_frames:true)
     3. listen to messages from the popup to toggle live
     4. re-apply on DOM mutations so eBay re-renders don't
        wipe out our work
     5. NUKE all header elements from the DOM and keep nuking
        them if eBay re-injects via Marko
   ============================================================ */

(function () {
  "use strict";

  const STORAGE_KEY = "eblc_enabled";
  const CLASS_ON = "eblc-on";
  const CLASS_OFF = "eblc-off";

  /* --- header nuke: rimuove fisicamente dal DOM ----------- */

  const HEADER_SELECTORS = [
    "#gh",
    "header#gh",
    "header.gh-header",
    ".ghw",
    ".ghw--loaded",
    "[id^=\"gh-\"]",
    ".gh-banner",
    ".gh-flyout",
    "nav.gh-nav",
    "header._root_8dbp8_39",
    "header[class*=\"_root_8dbp8_\"]",
    "[data-marko-key*=\"@gh\"]",
    "[role=\"banner\"]",
    "header"
  ];

  function nukeHeaders() {
    HEADER_SELECTORS.forEach(function (sel) {
      try {
        const els = document.querySelectorAll(sel);
        for (let i = 0; i < els.length; i++) {
          const el = els[i];
          if (
            el &&
            el.parentNode &&
            el.tagName !== "BODY" &&
            el.tagName !== "HTML" &&
            el.id !== "mainContent"
          ) {
            el.parentNode.removeChild(el);
          }
        }
      } catch (_) {
        /* ignore selector errors */
      }
    });
  }

  /* --- storage helpers ----------------------------------- */

  function getStorage() {
    return typeof browser !== "undefined" && browser.storage
      ? browser.storage
      : (typeof chrome !== "undefined" && chrome.storage ? chrome.storage : null);
  }

  /* --- chat helper: sposta la chat nel DOM per posizionarla bene --- */

  function checkAndRepositionChat() {
    if (!document.documentElement.classList.contains(CLASS_ON)) return;

    // Cerca il contenitore della chat (puo' essere la chat stessa o il wrapper, tag-agnostico)
    let chat = document.querySelector('[class^="_chat_"], [class*=" _chat_"]');
    if (!chat) {
      chat = document.querySelector('[class^="chat-"], [class*=" chat-"]');
    }
    if (!chat) return;

    const root = document.getElementById("root");
    if (root && chat.parentNode !== root) {
      if (!chat.dataset.originalParentId) {
        const parent = chat.parentNode;
        if (parent) {
          if (!parent.id) {
            parent.id = "eblc-orig-chat-parent-" + Math.random().toString(36).substr(2, 9);
          }
          chat.dataset.originalParentId = parent.id;
        }
      }
      root.appendChild(chat);
      chat.classList.add("eblc-chat-moved");
    }
  }

  function restoreChatPosition() {
    const chat = document.querySelector(".eblc-chat-moved");
    if (chat && chat.dataset.originalParentId) {
      const origParent = document.getElementById(chat.dataset.originalParentId);
      if (origParent) {
        origParent.appendChild(chat);
      }
      chat.classList.remove("eblc-chat-moved");
      delete chat.dataset.originalParentId;
    }
  }

  function applyState(enabled) {
    const root = document.documentElement;
    if (!root) return;
    if (enabled) {
      root.classList.add(CLASS_ON);
      root.classList.remove(CLASS_OFF);
      checkAndRepositionChat();
    } else {
      root.classList.remove(CLASS_ON);
      root.classList.add(CLASS_OFF);
      restoreChatPosition();
    }
  }

  function readStateAndApply() {
    const storage = getStorage();
    if (!storage || !storage.local) {
      applyState(true);
      return;
    }
    const get = storage.local.get;
    const promise = get.call(storage.local, STORAGE_KEY);
    if (promise && typeof promise.then === "function") {
      promise.then(
        (data) => applyState(data && data[STORAGE_KEY] !== false),
        () => applyState(true)
      );
    } else {
      try {
        get.call(storage.local, STORAGE_KEY, (data) =>
          applyState(!data || data[STORAGE_KEY] !== false)
        );
      } catch (_) {
        applyState(true);
      }
    }
  }

  function handleMessage(msg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "EBLC_TOGGLE") {
      const storage = getStorage();
      const next = !!msg.enabled;
      applyState(next);
      if (storage && storage.local && storage.local.set) {
        try {
          storage.local.set({ [STORAGE_KEY]: next });
        } catch (_) {
          /* ignore */
        }
      }
    } else if (msg.type === "EBLC_GET_STATE") {
      return Promise.resolve({
        enabled: document.documentElement.classList.contains(CLASS_ON),
      });
    }
  }

  // react to popup changes
  try {
    if (typeof browser !== "undefined" && browser.runtime && browser.runtime.onMessage) {
      browser.runtime.onMessage.addListener(handleMessage);
    } else if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage);
    }
  } catch (_) {
    /* ignore */
  }

  // storage changes from another frame / popup
  try {
    const storage = getStorage();
    if (storage && storage.onChanged && storage.onChanged.addListener) {
      storage.onChanged.addListener((changes, area) => {
        if (area !== "local" || !changes[STORAGE_KEY]) return;
        const nv = changes[STORAGE_KEY].newValue;
        applyState(nv === undefined ? true : !!nv);
      });
    }
  } catch (_) {
    /* ignore */
  }

  // initial application: wait for <html> to exist
  if (document.documentElement) {
    readStateAndApply();
  } else {
    document.addEventListener("DOMContentLoaded", readStateAndApply, { once: true });
  }

  // re-apply after SPA / eBay re-renders. Cheap, runs only when DOM changes.
  // Limit to attribute changes on <html> and to childList on <body>, capped
  // to avoid hot loops on heavy streams.
  try {
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        const storage = getStorage();
        if (!storage || !storage.local) {
          applyState(true);
          return;
        }
        const get = storage.local.get;
        const p = get.call(storage.local, STORAGE_KEY);
        if (p && typeof p.then === "function") {
          p.then((data) => applyState(data && data[STORAGE_KEY] !== false), () => applyState(true));
        }
      });
    });
    const start = () => {
      if (!document.documentElement) return;
      observer.observe(document.documentElement, {
        attributes: true,
        childList: true,
        subtree: false,
      });
    };
    if (document.documentElement) start();
    else document.addEventListener("DOMContentLoaded", start, { once: true });
  } catch (_) {
    /* MutationObserver missing - non-fatal */
  }

  /* --- header nuke: avvio + observer ---------------------- */

  // esegui subito se il body esiste
  if (document.body) {
    nukeHeaders();
  } else {
    document.addEventListener("DOMContentLoaded", nukeHeaders, { once: true });
  }

  // MutationObserver dedicato: se eBay re-inietta l'header,
  // lo rileggiamo e lo ririmuoviamo
  try {
    let nukeScheduled = false;
    const headerObserver = new MutationObserver(() => {
      if (nukeScheduled) return;
      nukeScheduled = true;
      requestAnimationFrame(() => {
        nukeScheduled = false;
        nukeHeaders();
        checkAndRepositionChat();
      });
    });
    const startHeaderObserver = () => {
      if (!document.body) return;
      headerObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    };
    if (document.body) startHeaderObserver();
    else document.addEventListener("DOMContentLoaded", startHeaderObserver, { once: true });
  } catch (_) {
    /* MutationObserver missing - non-fatal */
  }
})();
