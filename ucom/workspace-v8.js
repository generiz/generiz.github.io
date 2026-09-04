(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);

  function ensureStyle() {
    if (document.getElementById("workspaceV8Style")) return;
    const link = document.createElement("link");
    link.id = "workspaceV8Style";
    link.rel = "stylesheet";
    link.href = "./workspace-v8.css?v=8";
    document.head.appendChild(link);
  }

  function enhanceTemplates() {
    const select = $("#templateInput");
    if (!select || select.dataset.v8 === "1") return;
    select.dataset.v8 = "1";
    select.classList.add("template-select-hidden");

    const defs = [
      ["ucom", "Institucional", "Académica UCOM"],
      ["minimal", "Monografía", "Premium"],
      ["visual", "Actividades", "Ejercicios"],
    ];

    const picker = document.createElement("div");
    picker.className = "workspace-template-picker";
    picker.setAttribute("aria-label", "Diseño del documento");

    defs.forEach(([value, title, sub]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-template-option";
      button.dataset.template = value;
      button.innerHTML = `<span class="template-mini" aria-hidden="true"></span><span class="workspace-template-copy"><strong>${title}</strong><span>${sub}</span></span>`;
      button.addEventListener("click", () => {
        if (select.value === value) return;
        select.value = value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        syncTemplateState();
      });
      picker.appendChild(button);
    });

    select.parentElement?.appendChild(picker);
    select.addEventListener("input", syncTemplateState);
    select.addEventListener("change", syncTemplateState);
    syncTemplateState();
  }

  function syncTemplateState() {
    const select = $("#templateInput");
    if (!select) return;
    document.querySelectorAll(".workspace-template-option").forEach(button => {
      const active = button.dataset.template === select.value;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function actorName() {
    const badge = $("#accessBadge");
    const raw = badge?.textContent?.trim() || "";
    if (!raw) return "";
    if (raw === "Administrador") return "Administrador";
    return raw.replace(/\s*·\s*edición.*$/i, "").trim();
  }

  function syncActor() {
    const actor = $("#chatActor");
    if (!actor) return;
    const name = actorName();
    actor.textContent = name ? `Escribís como ${name}` : "";
  }

  function enhanceChat() {
    const panel = $(".chat-panel");
    if (!panel || panel.dataset.v8 === "1") return;
    panel.dataset.v8 = "1";
    panel.classList.add("chat-dock");

    const head = panel.querySelector(".chat-head");
    const titleGroup = head?.querySelector(":scope > div");
    if (titleGroup && !$("#chatActor")) {
      const actor = document.createElement("span");
      actor.id = "chatActor";
      actor.className = "chat-actor";
      titleGroup.appendChild(actor);
    }

    if (head && !head.querySelector(".chat-actions")) {
      const refresh = $("#refreshChatBtn");
      const actions = document.createElement("div");
      actions.className = "chat-actions";
      if (refresh) actions.appendChild(refresh);

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "chat-toggle";
      toggle.setAttribute("aria-label", "Minimizar chat");
      toggle.textContent = "—";
      toggle.addEventListener("click", () => {
        const collapsed = panel.classList.toggle("chat-collapsed");
        toggle.textContent = collapsed ? "+" : "—";
        toggle.setAttribute("aria-label", collapsed ? "Abrir chat" : "Minimizar chat");
      });
      actions.appendChild(toggle);
      head.appendChild(actions);
    }

    const badge = $("#accessBadge");
    if (badge) new MutationObserver(syncActor).observe(badge, { childList: true, subtree: true });
    syncActor();
  }

  function cleanPreview() {
    const preview = $("#previewPaper");
    if (!preview) return;
    const footer = preview.querySelector(".doc-footer");
    if (footer && footer.textContent !== "UCOM") footer.textContent = "UCOM";
  }

  function watchPreview() {
    const preview = $("#previewPaper");
    if (!preview || preview.dataset.v8watch === "1") return;
    preview.dataset.v8watch = "1";
    new MutationObserver(cleanPreview).observe(preview, { childList: true, subtree: true });
    cleanPreview();
  }

  function init() {
    ensureStyle();
    enhanceTemplates();
    enhanceChat();
    watchPreview();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
