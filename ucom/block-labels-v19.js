(() => {
  "use strict";

  const API = "https://ucom-api.ufotech.com.py";
  const ADMIN_KEY = "ucom.admin.session.v2";
  const GOOGLE_KEY = "ucom.google.session.v11";
  const LABELS = {
    consigna: "Consigna",
    desarrollo: "Desarrollo",
    respuesta: "Respuesta",
    ejercicio: "Ejercicio",
    texto: "Texto",
    formula: "Fórmula",
    nota: "Nota",
  };
  const $ = (s, root=document) => root.querySelector(s);
  const localLabels = new Map();
  const saveTimers = new Map();
  let syncing = new Set();

  const projectId = () => {
    const m = location.hash.match(/^#\/p\/([^/]+)\/?$/);
    return m ? decodeURIComponent(m[1]) : "";
  };
  const token = id => sessionStorage.getItem(ADMIN_KEY) || sessionStorage.getItem(`ucom.participant.${id}`) || localStorage.getItem(GOOGLE_KEY) || "";

  function xhr(method, path, authToken="", body) {
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
        else reject(Object.assign(new Error(data.error || `HTTP ${req.status || 0}`), {status:req.status,data}));
      };
      req.onerror = () => reject(new Error("No se pudo conectar con el servidor"));
      req.send(body === undefined ? null : JSON.stringify(body));
    });
  }

  function toast(message, error=false) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.className = `toast show ${error ? "error" : ""}`;
    setTimeout(() => { if (el.textContent === message) el.className = "toast"; }, 3000);
  }

  function blockState() {
    const state = window.UCOMBlocksV15?.getState?.();
    return Array.isArray(state?.blocks) ? state.blocks : [];
  }

  function defaultLabel(block) {
    return LABELS[block?.type] || "Contenido";
  }

  function serverLabel(block) {
    return Object.prototype.hasOwnProperty.call(block || {}, "label") ? String(block.label ?? "") : defaultLabel(block);
  }

  function visibleLabel(block) {
    return localLabels.has(block.id) ? localLabels.get(block.id) : serverLabel(block);
  }

  function installEditors() {
    const blocks = blockState();
    if (!blocks.length) return;
    const byId = new Map(blocks.map(block => [block.id, block]));
    document.querySelectorAll("#blocksListV15 .block-card-v15").forEach(card => {
      const id = card.dataset.id || "";
      const block = byId.get(id);
      if (!id || !block) return;
      const foot = $(".block-foot-v15", card);
      if (!foot) return;

      let wrap = $(".block-label-wrap-v19", foot);
      if (!wrap) {
        wrap = document.createElement("label");
        wrap.className = "block-label-wrap-v19";
        wrap.innerHTML = '<span>Etiqueta</span><input class="block-label-input-v19" maxlength="100" autocomplete="off">';
        foot.prepend(wrap);
        const input = $(".block-label-input-v19", wrap);
        input.value = visibleLabel(block);
        input.addEventListener("input", () => onLabelInput(id, input.value));
        input.addEventListener("blur", () => saveLabel(id, input.value));
      }

      const input = $(".block-label-input-v19", wrap);
      const wanted = visibleLabel(block);
      if (input && document.activeElement !== input && input.value !== wanted) input.value = wanted;
      if (input) input.disabled = !!$("#workspace")?.classList.contains("task-finalized-v18");
    });
  }

  function onLabelInput(blockId, value) {
    localLabels.set(blockId, value);
    applyPreviewLabels();
    clearTimeout(saveTimers.get(blockId));
    saveTimers.set(blockId, setTimeout(() => saveLabel(blockId, value), 850));
  }

  async function saveLabel(blockId, value) {
    clearTimeout(saveTimers.get(blockId));
    saveTimers.delete(blockId);
    const id = projectId();
    const authToken = token(id);
    if (!id || !authToken || syncing.has(blockId)) return;
    syncing.add(blockId);
    try {
      const data = await xhr("PUT", `/api/projects/${encodeURIComponent(id)}/blocks-v15/${encodeURIComponent(blockId)}/label-v19`, authToken, {label:value});
      if (localLabels.get(blockId) === value) {
        localLabels.set(blockId, String(data.label ?? value));
      }
    } catch (error) {
      if (error.status === 423) toast("La tarea está finalizada", true);
      else toast(error.message || "No se pudo guardar la etiqueta", true);
    } finally {
      syncing.delete(blockId);
    }
  }

  function reconcileLocal() {
    for (const block of blockState()) {
      if (!localLabels.has(block.id)) continue;
      if (!saveTimers.has(block.id) && !syncing.has(block.id) && serverLabel(block) === localLabels.get(block.id)) {
        localLabels.delete(block.id);
      }
    }
  }

  function applyPreviewLabels() {
    const blocks = blockState();
    const sections = [...document.querySelectorAll("#previewPaper .doc-block-v15")];
    blocks.forEach((block, index) => {
      const section = sections[index];
      const label = section?.querySelector(".doc-block-label-v15");
      if (!label) return;
      const text = visibleLabel(block).trim();
      label.textContent = text;
      label.hidden = !text;
    });
  }

  function tick() {
    if (!projectId()) return;
    reconcileLocal();
    installEditors();
    applyPreviewLabels();
  }

  function init() {
    setInterval(tick, 220);
    window.addEventListener("hashchange", () => {
      localLabels.clear();
      saveTimers.forEach(timer => clearTimeout(timer));
      saveTimers.clear();
      setTimeout(tick, 500);
    });
    window.addEventListener("ucom:lifecycle-v18", tick);
    setTimeout(tick, 750);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
