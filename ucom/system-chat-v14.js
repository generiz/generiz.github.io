(() => {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);

  const ROBOT = `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3v3"/><circle cx="12" cy="2.5" r="1" fill="currentColor" stroke="none"/>
      <rect x="5" y="6" width="14" height="12" rx="4"/>
      <path d="M8 18v2M16 18v2M5 11H3v4h2M19 11h2v4h-2"/>
      <circle cx="9" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="11" r="1" fill="currentColor" stroke="none"/>
      <path d="M9 15h6"/>
    </svg>`;

  function decorateMessage(item) {
    if (!(item instanceof Element) || !item.classList.contains("chat-message")) return;
    const who = $(".chat-meta strong", item);
    if (!who || who.textContent.trim() !== "Sistema") return;
    if (item.classList.contains("system-message-v14")) return;

    item.classList.add("system-message-v14");
    item.classList.remove("mine");
    const avatar = document.createElement("span");
    avatar.className = "system-avatar-v14";
    avatar.title = "Sistema";
    avatar.setAttribute("aria-label", "Sistema");
    avatar.innerHTML = ROBOT;
    item.prepend(avatar);
  }

  function decorateAll(root = document) {
    root.querySelectorAll?.(".chat-message").forEach(decorateMessage);
  }

  function init() {
    const panel = $(".chat-panel");
    const box = $("#chatMessages");
    if (!panel || !box) return;
    panel.classList.add("system-chat-ready-v14");
    decorateAll(box);

    const observer = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.classList.contains("chat-message")) decorateMessage(node);
          decorateAll(node);
        }
      }
    });
    observer.observe(box, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
