(() => {
  "use strict";

  const API = "https://ucom-api.ufotech.com.py";
  const ADMIN_KEY = "ucom.admin.session.v2";
  const GOOGLE_KEY = "ucom.google.session.v11";
  const $ = (s, root=document) => root.querySelector(s);
  let state = null;
  let currentProject = "";
  let loading = false;

  const projectId = () => {
    const m = location.hash.match(/^#\/p\/([^/]+)\/?$/);
    return m ? decodeURIComponent(m[1]) : "";
  };
  const adminToken = () => sessionStorage.getItem(ADMIN_KEY) || "";
  const token = id => adminToken() || sessionStorage.getItem(`ucom.participant.${id}`) || localStorage.getItem(GOOGLE_KEY) || "";

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
    setTimeout(() => { if (el.textContent === message) el.className = "toast"; }, 3200);
  }

  function ensureControls() {
    const actions = $(".workspace-actions");
    if (!actions) return;
    if (!$("#lifecycleBadgeV18")) {
      const badge = document.createElement("span");
      badge.id = "lifecycleBadgeV18";
      badge.className = "lifecycle-badge-v18";
      badge.textContent = "Abierta";
      actions.prepend(badge);
    }
    if (!$("#finalizeTaskV18")) {
      const button = document.createElement("button");
      button.id = "finalizeTaskV18";
      button.type = "button";
      button.className = "ghost";
      button.textContent = "Finalizar tarea";
      button.addEventListener("click", finalizeTask);
      $("#saveBtn")?.before(button);
    }
    if (!$("#reopenTaskV18")) {
      const button = document.createElement("button");
      button.id = "reopenTaskV18";
      button.type = "button";
      button.className = "ghost hidden";
      button.textContent = "Reabrir";
      button.addEventListener("click", reopenTask);
      $("#saveBtn")?.before(button);
    }
  }

  function disableEditor(finalized) {
    const workspace = $("#workspace");
    workspace?.classList.toggle("task-finalized-v18", finalized);
    const selectors = [
      ".directives-panel input", ".directives-panel textarea", ".directives-panel select",
      ".content-panel input", ".content-panel textarea", ".content-panel select",
    ];
    document.querySelectorAll(selectors.join(",")).forEach(el => {
      if (finalized) {
        if (!el.dataset.lifecycleDisabledV18) el.dataset.lifecycleDisabledV18 = el.disabled ? "already" : "added";
        el.disabled = true;
      } else if (el.dataset.lifecycleDisabledV18 === "added") {
        el.disabled = false;
        delete el.dataset.lifecycleDisabledV18;
      }
    });
  }

  function applyState(next) {
    state = next || {status:"open",finalized:false};
    ensureControls();
    const finalized = !!state.finalized || state.status === "finalized";
    disableEditor(finalized);
    const badge = $("#lifecycleBadgeV18");
    if (badge) badge.textContent = finalized ? "Finalizada" : "Abierta";
    const admin = !!adminToken();
    $("#finalizeTaskV18")?.classList.toggle("hidden", !admin || finalized);
    $("#reopenTaskV18")?.classList.toggle("hidden", !admin || !finalized);
    const saveState = $("#saveState");
    if (saveState && finalized) saveState.textContent = "Edición cerrada";
    window.dispatchEvent(new CustomEvent("ucom:lifecycle-v18", { detail: state }));
  }

  async function load(force=false) {
    const id = projectId();
    if (!id) { currentProject=""; state=null; return; }
    const authToken = token(id);
    if (!authToken || loading) return;
    if (!force && id === currentProject && state) return;
    loading = true;
    try {
      const data = await xhr("GET", `/api/projects/${encodeURIComponent(id)}/lifecycle-v18`, authToken);
      if (projectId() !== id) return;
      currentProject = id;
      applyState(data);
    } catch (error) {
      if (error.status !== 401) toast(error.message || "No se pudo leer el estado de la tarea", true);
    } finally { loading = false; }
  }

  async function flushEditing() {
    const api = window.UCOMBlocksV15;
    if (api?.getState?.().dirty) {
      const ok = await api.saveNow();
      if (!ok && api.getState?.().dirty) throw new Error("Todavía hay cambios sin sincronizar");
    }
  }

  async function finalizeTask() {
    const id = projectId();
    const authToken = adminToken();
    if (!id || !authToken) return;
    if (!confirm("¿Finalizar esta tarea? Se cerrará la edición para todos y se habilitarán PDF y DOC.")) return;
    const button = $("#finalizeTaskV18");
    if (button) { button.disabled = true; button.textContent = "Finalizando…"; }
    try {
      await flushEditing();
      const data = await xhr("POST", `/api/projects/${encodeURIComponent(id)}/finalize-v18`, authToken, {});
      applyState(data);
      toast("Tarea finalizada");
    } catch (error) { toast(error.message || "No se pudo finalizar", true); }
    finally { if (button) { button.disabled = false; button.textContent = "Finalizar tarea"; } }
  }

  async function reopenTask() {
    const id = projectId();
    const authToken = adminToken();
    if (!id || !authToken) return;
    if (!confirm("¿Reabrir la tarea y habilitar nuevamente la edición?")) return;
    try {
      const data = await xhr("POST", `/api/projects/${encodeURIComponent(id)}/reopen-v18`, authToken, {});
      applyState(data);
      toast("Tarea reabierta");
      setTimeout(() => location.reload(), 250);
    } catch (error) { toast(error.message || "No se pudo reabrir", true); }
  }

  function init() {
    ensureControls();
    window.addEventListener("hashchange", () => setTimeout(() => load(true), 180));
    window.addEventListener("ucom:finalized-write-v18", () => load(true));
    const badge = $("#accessBadge");
    if (badge) new MutationObserver(() => { if (projectId()) load(true); }).observe(badge,{childList:true,subtree:true});
    setTimeout(() => load(true), 650);
    setInterval(() => { if (projectId()) load(true); }, 5000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();

(() => {
  if (!document.querySelector('link[data-block-labels-v19]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./block-labels-v19.css?v=19";
    link.dataset.blockLabelsV19 = "1";
    document.head.appendChild(link);
  }
  if (!document.querySelector('script[data-block-labels-v19]')) {
    const script = document.createElement("script");
    script.src = "./block-labels-v19.js?v=19";
    script.defer = true;
    script.dataset.blockLabelsV19 = "1";
    document.head.appendChild(script);
  }
})();
