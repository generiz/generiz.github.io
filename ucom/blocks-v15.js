(() => {
  "use strict";

  const API = "https://ucom-api.ufotech.com.py";
  const ADMIN_KEY = "ucom.admin.session.v2";
  const GOOGLE_KEY = "ucom.google.session.v11";
  const TYPES = [
    ["consigna", "Consigna"],
    ["desarrollo", "Desarrollo"],
    ["respuesta", "Respuesta"],
    ["ejercicio", "Ejercicio"],
    ["texto", "Texto"],
    ["formula", "Fórmula"],
    ["nota", "Nota"],
  ];
  const LABELS = Object.fromEntries(TYPES);
  const AUTO_COLORS = ["#43358b", "#00a75d", "#e5a900", "#35aada", "#f54c27"];
  const ACCENTS = {
    purple: "#43358b",
    green: "#00a75d",
    yellow: "#e5a900",
    blue: "#35aada",
    orange: "#f54c27",
  };
  const $ = (s, root = document) => root.querySelector(s);
  let currentProject = "";
  let blocks = [];
  let revision = 0;
  let saveTimer = 0;
  let saving = false;
  let pendingSave = false;
  let loaded = false;

  const projectId = () => {
    const m = location.hash.match(/^#\/p\/([^/]+)\/?$/);
    return m ? decodeURIComponent(m[1]) : "";
  };
  const token = id => sessionStorage.getItem(ADMIN_KEY) || sessionStorage.getItem(`ucom.participant.${id}`) || localStorage.getItem(GOOGLE_KEY) || "";

  function xhr(method, path, authToken = "", body) {
    return new Promise((resolve, reject) => {
      const req = new XMLHttpRequest();
      req.open(method, `${API}${path}`, true);
      req.setRequestHeader("Accept", "application/json");
      if (body !== undefined) req.setRequestHeader("Content-Type", "application/json");
      if (authToken) req.setRequestHeader("Authorization", `Bearer ${authToken}`);
      req.onreadystatechange = () => {
        if (req.readyState !== 4) return;
        let data = {};
        try { data = req.responseText ? JSON.parse(req.responseText) : {}; } catch {}
        if (req.status >= 200 && req.status < 300) resolve(data);
        else reject(Object.assign(new Error(data.error || `HTTP ${req.status || 0}`), { status: req.status, data }));
      };
      req.onerror = () => reject(new Error("No se pudo conectar con el servidor"));
      req.send(body === undefined ? null : JSON.stringify(body));
    });
  }

  function toast(message, error = false) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.className = `toast show ${error ? "error" : ""}`;
    setTimeout(() => { if (el.textContent === message) el.className = "toast"; }, 3200);
  }

  function id() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function defaultTitle(type) { return LABELS[type] || "Texto"; }
  function newBlock(type = "desarrollo") {
    return { id: id(), type, title: defaultTitle(type), body: "", accent: "auto" };
  }

  function installEditor() {
    const panel = $(".content-panel");
    if (!panel || $("#blocksEditorV15")) return;
    panel.classList.add("blocks-mode-v15");
    $(".directives-panel")?.classList.add("blocks-v15-active");

    const editor = document.createElement("div");
    editor.id = "blocksEditorV15";
    editor.className = "blocks-editor-v15";
    editor.innerHTML = `
      <div class="blocks-toolbar-v15">
        <div class="blocks-add-v15">
          <select id="blockTypeAddV15" aria-label="Tipo de bloque">
            ${TYPES.map(([value,label]) => `<option value="${value}">${label}</option>`).join("")}
          </select>
          <button id="addBlockV15" class="ghost" type="button">+ Agregar</button>
          <span id="blocksSaveV15" class="blocks-save-v15"></span>
        </div>
        <span id="blocksCountV15" class="blocks-count-v15"></span>
      </div>
      <div id="blocksListV15" class="blocks-list-v15"></div>`;
    panel.appendChild(editor);

    $("#addBlockV15")?.addEventListener("click", () => {
      const type = $("#blockTypeAddV15")?.value || "desarrollo";
      blocks.push(newBlock(type));
      renderEditor();
      changed(true);
      const last = $("#blocksListV15 .block-card-v15:last-child .block-body-v15");
      last?.focus();
    });

    $("#saveBtn")?.addEventListener("click", () => saveNow(), true);
    ["#subjectInput", "#titleInput", "#professorInput", "#dueDateInput", "#membersInput", "#templateInput"].forEach(selector => {
      const el = $(selector);
      el?.addEventListener("input", () => setTimeout(renderPreview, 0));
      el?.addEventListener("change", () => setTimeout(renderPreview, 0));
    });
  }

  function renderEditor() {
    const list = $("#blocksListV15");
    const count = $("#blocksCountV15");
    if (!list) return;
    if (count) count.textContent = `${blocks.length} ${blocks.length === 1 ? "bloque" : "bloques"}`;
    if (!blocks.length) {
      list.innerHTML = '<div class="blocks-empty-v15">Agregá el primer bloque.</div>';
      return;
    }
    list.replaceChildren(...blocks.map((block, index) => blockNode(block, index)));
  }

  function blockNode(block, index) {
    const card = document.createElement("section");
    card.className = "block-card-v15";
    card.dataset.id = block.id;
    card.style.setProperty("--block-accent", accentColor(block, index));

    const head = document.createElement("div");
    head.className = "block-head-v15";

    const type = document.createElement("select");
    type.setAttribute("aria-label", "Tipo");
    TYPES.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = value === block.type;
      type.appendChild(option);
    });
    type.addEventListener("change", () => {
      const oldDefault = defaultTitle(block.type);
      block.type = type.value;
      if (!block.title || block.title === oldDefault) block.title = defaultTitle(block.type);
      renderEditor();
      changed(true);
    });

    const title = document.createElement("input");
    title.className = "block-title-v15";
    title.value = block.title || "";
    title.maxLength = 180;
    title.placeholder = defaultTitle(block.type);
    title.addEventListener("input", () => {
      block.title = title.value;
      changed(false);
      renderPreview();
    });

    const actions = document.createElement("div");
    actions.className = "block-actions-v15";
    actions.append(
      actionButton("↑", "Subir", () => move(index, -1), index === 0),
      actionButton("↓", "Bajar", () => move(index, 1), index === blocks.length - 1),
      actionButton("×", "Eliminar", () => remove(index), false, true),
    );
    head.append(type, title, actions);

    const body = document.createElement("textarea");
    body.className = "block-body-v15";
    body.value = block.body || "";
    body.spellcheck = block.type !== "formula";
    body.placeholder = block.type === "formula" ? "Ej.: \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}" : "Escribí aquí…";
    body.addEventListener("input", () => {
      block.body = body.value;
      autoHeight(body);
      changed(false);
      renderPreview();
    });
    requestAnimationFrame(() => autoHeight(body));

    const foot = document.createElement("div");
    foot.className = "block-foot-v15";
    const picker = document.createElement("div");
    picker.className = "accent-picker-v15";
    picker.append(accentButton("auto", "Auto", block));
    Object.keys(ACCENTS).forEach(name => picker.append(accentButton(name, name, block)));
    foot.append(picker);

    card.append(head, body, foot);
    return card;
  }

  function actionButton(text, label, fn, disabled = false, danger = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `block-icon-v15${danger ? " danger" : ""}`;
    button.textContent = text;
    button.title = label;
    button.disabled = disabled;
    button.addEventListener("click", fn);
    return button;
  }

  function accentButton(name, label, block) {
    const button = document.createElement("button");
    button.type = "button";
    button.title = label;
    button.className = name === "auto" ? "accent-dot-v15 accent-auto-v15" : "accent-dot-v15";
    if (block.accent === name) button.classList.add("active");
    if (name === "auto") button.textContent = "Auto";
    else button.style.setProperty("--dot", ACCENTS[name]);
    button.addEventListener("click", () => {
      block.accent = name;
      renderEditor();
      changed(true);
      renderPreview();
    });
    return button;
  }

  function autoHeight(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(360, Math.max(72, textarea.scrollHeight))}px`;
  }

  function move(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const [item] = blocks.splice(index, 1);
    blocks.splice(target, 0, item);
    renderEditor();
    changed(true);
    renderPreview();
  }

  function remove(index) {
    const block = blocks[index];
    if (!block) return;
    if ((block.body || "").trim() && !confirm(`¿Eliminar ${block.title || defaultTitle(block.type)}?`)) return;
    blocks.splice(index, 1);
    renderEditor();
    changed(true);
    renderPreview();
  }

  function changed(structural) {
    syncLegacy(true);
    setBlockState(structural ? "Cambios pendientes" : "Sin guardar", "");
    setTimeout(renderPreview, 0);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveNow(), structural ? 500 : 1400);
  }

  function syncLegacy(markDirty = false) {
    const directives = $("#directivesInput");
    const content = $("#contentInput");
    const consigna = blocks
      .filter(b => b.type === "consigna")
      .map(b => [b.title, b.body].filter(Boolean).join("\n"))
      .join("\n\n");
    const rest = blocks
      .filter(b => b.type !== "consigna")
      .map(b => {
        const title = b.title || defaultTitle(b.type);
        if (b.type === "formula") return `## ${title}\n$$\n${b.body}\n$$`;
        return `## ${title}\n${b.body}`;
      })
      .join("\n\n");
    if (directives) directives.value = consigna;
    if (content) content.value = rest;
    if (markDirty && content) content.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function load(force = false) {
    installEditor();
    const id = projectId();
    if (!id) {
      currentProject = "";
      loaded = false;
      return;
    }
    const authToken = token(id);
    if (!authToken) return;
    if (!force && loaded && currentProject === id) return;
    currentProject = id;
    loaded = false;
    try {
      const data = await xhr("GET", `/api/projects/${encodeURIComponent(id)}/blocks-v15`, authToken);
      if (projectId() !== id) return;
      blocks = Array.isArray(data.blocks) ? data.blocks : [];
      revision = Number(data.revision || 0);
      loaded = true;
      renderEditor();
      syncLegacy(false);
      renderPreview();
      setBlockState(data.legacy && blocks.length ? "Contenido anterior listo" : "", "");
    } catch {
      setBlockState("No se pudo cargar", "error");
    }
  }

  async function saveNow() {
    clearTimeout(saveTimer);
    const id = projectId();
    const authToken = token(id);
    if (!loaded || !id || !authToken) return;
    if (saving) {
      pendingSave = true;
      return;
    }
    saving = true;
    pendingSave = false;
    setBlockState("Guardando…", "saving");
    syncLegacy(false);
    try {
      const data = await xhr("PUT", `/api/projects/${encodeURIComponent(id)}/blocks-v15`, authToken, {
        blocks,
        expected_revision: revision,
      });
      revision = Number(data.revision || revision + 1);
      setBlockState("Guardado", "");
    } catch (error) {
      if (error.status === 409 && Array.isArray(error.data?.blocks)) {
        blocks = error.data.blocks;
        revision = Number(error.data.revision || revision);
        renderEditor();
        syncLegacy(false);
        renderPreview();
        toast("Otra persona guardó cambios. Recargué la última versión.", true);
      } else {
        setBlockState("Error al guardar", "error");
        toast(error.message || "No se pudo guardar el contenido", true);
      }
    } finally {
      saving = false;
      if (pendingSave) saveNow();
    }
  }

  function setBlockState(text, cls) {
    const el = $("#blocksSaveV15");
    if (!el) return;
    el.textContent = text;
    el.className = `blocks-save-v15${cls ? ` ${cls}` : ""}`;
  }

  function accentColor(block, index) {
    return block.accent && block.accent !== "auto"
      ? (ACCENTS[block.accent] || AUTO_COLORS[index % AUTO_COLORS.length])
      : AUTO_COLORS[index % AUTO_COLORS.length];
  }

  function renderPreview() {
    if (!loaded) return;
    const root = $("#previewPaper");
    if (!root) return;
    root.querySelector(".doc-directives")?.setAttribute("hidden", "");
    root.querySelector(".doc-body")?.setAttribute("hidden", "");
    root.querySelector(".doc-blocks-v15")?.remove();

    const wrapper = document.createElement("div");
    wrapper.className = "doc-blocks-v15";
    blocks.forEach((block, index) => {
      const section = document.createElement("section");
      section.className = `doc-block-v15 type-${block.type}`;
      section.style.setProperty("--block-accent", accentColor(block, index));

      const label = document.createElement("span");
      label.className = "doc-block-label-v15";
      label.textContent = LABELS[block.type] || "Contenido";
      section.append(label);

      if ((block.title || "").trim()) {
        const heading = document.createElement("h3");
        heading.textContent = block.title;
        section.append(heading);
      }

      const body = document.createElement("div");
      body.className = "doc-block-body-v15";
      const raw = block.body || "";
      const trimmed = raw.trim();
      const alreadyDelimited = /^(\\\[|\\\(|\$\$|\$)/.test(trimmed);
      body.textContent = block.type === "formula" && trimmed && !alreadyDelimited ? `\\[${raw}\\]` : raw;
      section.append(body);
      wrapper.append(section);
    });

    const footer = root.querySelector(".doc-footer");
    if (footer) root.insertBefore(wrapper, footer);
    else root.append(wrapper);

    if (window.MathJax?.typesetPromise) {
      try {
        window.MathJax.typesetClear?.([wrapper]);
        window.MathJax.typesetPromise([wrapper]).catch(() => {});
      } catch {}
    }
  }

  function syncAfterCoreRender() {
    if (!loaded) return;
    setTimeout(renderPreview, 0);
  }

  function init() {
    installEditor();
    document.addEventListener("input", event => {
      if (["subjectInput", "titleInput", "professorInput", "dueDateInput", "membersInput", "templateInput", "contentInput", "directivesInput"].includes(event.target?.id)) {
        syncAfterCoreRender();
      }
    });
    document.addEventListener("change", event => {
      if (["workTypeInput", "templateInput"].includes(event.target?.id)) syncAfterCoreRender();
    });
    window.addEventListener("hashchange", () => setTimeout(() => load(true), 350));
    setTimeout(() => load(true), 650);
    setInterval(() => {
      const id = projectId();
      if (id && (!loaded || id !== currentProject)) load(true);
    }, 2500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
