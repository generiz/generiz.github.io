(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  let mathBusy = false;
  let mathQueued = false;

  function ensureStyle() {
    if (document.getElementById("workspaceV9Style")) return;
    const link = document.createElement("link");
    link.id = "workspaceV9Style";
    link.rel = "stylesheet";
    link.href = "./workspace-v9.css?v=9";
    document.head.appendChild(link);
  }

  function ensureMathOption() {
    const select = $("#templateInput");
    if (!select) return;
    if (![...select.options].some(o => o.value === "math")) {
      const option = document.createElement("option");
      option.value = "math";
      option.textContent = "Matemáticas";
      select.appendChild(option);
    }
  }

  function syncTemplateState() {
    const select = $("#templateInput");
    if (!select) return;
    document.querySelectorAll(".workspace-template-option").forEach(button => {
      const active = button.dataset.template === select.value;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    $("#mathToolbar")?.classList.toggle("active", select.value === "math");
    queueMath();
  }

  function enhanceTemplates() {
    const select = $("#templateInput");
    if (!select) return;
    ensureMathOption();
    select.classList.add("template-select-hidden");
    select.parentElement?.querySelector(".workspace-template-picker")?.remove();

    const defs = [
      ["ucom", "Institucional"],
      ["minimal", "Monografía"],
      ["visual", "Actividades"],
      ["math", "Matemáticas"],
    ];

    const picker = document.createElement("div");
    picker.className = "workspace-template-picker";
    picker.setAttribute("aria-label", "Diseño del documento");

    defs.forEach(([value, title]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-template-option";
      button.dataset.template = value;
      button.innerHTML = `<span class="template-mini" aria-hidden="true"></span><span class="workspace-template-copy"><strong>${title}</strong></span>`;
      button.addEventListener("click", () => {
        select.value = value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncTemplateState();
      });
      picker.appendChild(button);
    });

    select.parentElement?.appendChild(picker);
    select.addEventListener("input", syncTemplateState);
    select.addEventListener("change", syncTemplateState);
    syncTemplateState();
  }

  function insertAtCursor(text) {
    const input = $("#contentInput");
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const before = input.value.slice(0, start);
    const after = input.value.slice(end);
    const lead = before && !before.endsWith("\n") && text.startsWith("$$") ? "\n\n" : "";
    const tail = text.startsWith("$$") && after && !after.startsWith("\n") ? "\n\n" : "";
    const value = `${lead}${text}${tail}`;
    input.setRangeText(value, start, end, "end");
    input.focus();
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function enhanceMathToolbar() {
    const panel = $(".content-panel");
    const editor = $("#contentInput");
    if (!panel || !editor || $("#mathToolbar")) return;

    const toolbar = document.createElement("div");
    toolbar.id = "mathToolbar";
    toolbar.className = "math-toolbar";
    const tools = [
      ["x²", "$x^{2}$", "Potencia"],
      ["a/b", "$\\frac{a}{b}$", "Fracción"],
      ["√", "$\\sqrt{x}$", "Raíz"],
      ["Σ", "$$\\sum_{i=1}^{n} a_i$$", "Sumatoria"],
      ["∫", "$$\\int_a^b f(x)\\,dx$$", "Integral"],
      ["lim", "$$\\lim_{x\\to a} f(x)$$", "Límite"],
      ["Matriz", "$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$", "Matriz"],
      ["Sistema", "$$\\begin{cases} x+y=5 \\\\ 2x-y=1 \\end{cases}$$", "Sistema de ecuaciones"],
    ];

    tools.forEach(([label, snippet, title]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `math-tool${label.length > 3 ? " wide" : ""}`;
      button.textContent = label;
      button.title = title;
      button.addEventListener("click", () => insertAtCursor(snippet));
      toolbar.appendChild(button);
    });

    editor.before(toolbar);
    syncTemplateState();
  }

  function actorName() {
    const raw = $("#accessBadge")?.textContent?.trim() || "";
    if (raw === "Administrador") return "Administrador";
    return raw.replace(/\s*·\s*edición.*$/i, "").trim();
  }

  function compactChat() {
    const panel = $(".chat-panel");
    if (!panel) return;
    panel.classList.add("chat-dock");
    let actor = $("#chatActor");
    const titleGroup = panel.querySelector(".chat-head > div");
    if (!actor && titleGroup) {
      actor = document.createElement("span");
      actor.id = "chatActor";
      actor.className = "chat-actor";
      titleGroup.appendChild(actor);
    }
    if (actor) actor.textContent = actorName() ? `Escribís como ${actorName()}` : "";

    const head = panel.querySelector(".chat-head");
    if (head && !head.querySelector(".chat-actions")) {
      const actions = document.createElement("div");
      actions.className = "chat-actions";
      const refresh = $("#refreshChatBtn");
      if (refresh) actions.appendChild(refresh);
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "chat-toggle";
      toggle.textContent = "—";
      toggle.setAttribute("aria-label", "Minimizar chat");
      toggle.addEventListener("click", () => {
        const collapsed = panel.classList.toggle("chat-collapsed");
        toggle.textContent = collapsed ? "+" : "—";
        toggle.setAttribute("aria-label", collapsed ? "Abrir chat" : "Minimizar chat");
      });
      actions.appendChild(toggle);
      head.appendChild(actions);
    }

    const badge = $("#accessBadge");
    if (badge && badge.dataset.actorWatch !== "1") {
      badge.dataset.actorWatch = "1";
      new MutationObserver(() => {
        const name = actorName();
        if ($("#chatActor")) $("#chatActor").textContent = name ? `Escribís como ${name}` : "";
      }).observe(badge, { childList: true, subtree: true });
    }
  }

  function splitInlineMath(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!parent || parent.closest("code,pre,.math-block,.math-inline,mjx-container,svg")) continue;
      if (node.nodeValue?.includes("$")) nodes.push(node);
    }

    nodes.forEach(node => {
      const text = node.nodeValue || "";
      const regex = /\$([^$\n]+)\$/g;
      let match;
      let last = 0;
      const fragment = document.createDocumentFragment();
      let changed = false;
      while ((match = regex.exec(text))) {
        changed = true;
        if (match.index > last) fragment.append(document.createTextNode(text.slice(last, match.index)));
        const span = document.createElement("span");
        span.className = "math-inline";
        span.dataset.latex = match[1];
        fragment.append(span);
        last = regex.lastIndex;
      }
      if (!changed) return;
      if (last < text.length) fragment.append(document.createTextNode(text.slice(last)));
      node.replaceWith(fragment);
    });
  }

  async function renderMathNow() {
    if (mathBusy) return;
    const preview = $("#previewPaper");
    if (!preview || $("#templateInput")?.value !== "math") return;
    if (!window.MathJax?.tex2svgPromise) {
      setTimeout(queueMath, 250);
      return;
    }

    mathBusy = true;
    try {
      splitInlineMath(preview);
      const blocks = [...preview.querySelectorAll(".math-block:not([data-math-rendered])")];
      const inline = [...preview.querySelectorAll(".math-inline:not([data-math-rendered])")];

      for (const node of blocks) {
        const latex = node.textContent.trim();
        if (!latex) continue;
        const rendered = await window.MathJax.tex2svgPromise(latex, { display: true });
        node.replaceChildren(rendered);
        node.dataset.mathRendered = "1";
      }
      for (const node of inline) {
        const latex = node.dataset.latex || "";
        if (!latex) continue;
        const rendered = await window.MathJax.tex2svgPromise(latex, { display: false });
        node.replaceChildren(rendered);
        node.dataset.mathRendered = "1";
      }
    } catch (error) {
      console.warn("Math render", error);
    } finally {
      mathBusy = false;
    }
  }

  function queueMath() {
    if (mathQueued) return;
    mathQueued = true;
    requestAnimationFrame(() => {
      mathQueued = false;
      renderMathNow();
    });
  }

  function watchPreview() {
    const preview = $("#previewPaper");
    if (!preview || preview.dataset.mathWatch === "1") return;
    preview.dataset.mathWatch = "1";
    new MutationObserver(() => {
      if (!mathBusy) queueMath();
    }).observe(preview, { childList: true, subtree: true, characterData: true });
    queueMath();
  }

  function init() {
    ensureStyle();
    ensureMathOption();
    enhanceTemplates();
    enhanceMathToolbar();
    compactChat();
    watchPreview();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
