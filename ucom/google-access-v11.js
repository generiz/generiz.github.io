(() => {
  "use strict";

  const API = "https://ucom-api.ufotech.com.py";
  const ADMIN_KEY = "ucom.admin.session.v2";
  const GOOGLE_KEY = "ucom.google.session.v11";
  const $ = (s, root = document) => root.querySelector(s);
  let googleConfig = null;
  let googleInitClient = "";
  let googleScriptPromise = null;
  let pendingGoogleProject = "";
  let pendingShareProject = "";

  const projectIdFromHash = () => {
    const m = location.hash.match(/^#\/p\/([^/]+)\/?$/);
    return m ? decodeURIComponent(m[1]) : "";
  };
  const classIdFromHash = () => {
    const m = location.hash.match(/^#\/class\/([^/]+)\/?$/);
    return m ? decodeURIComponent(m[1]) : "";
  };
  const adminToken = () => sessionStorage.getItem(ADMIN_KEY) || "";
  const googleToken = () => localStorage.getItem(GOOGLE_KEY) || "";

  // app.js reads project-scoped participant tokens. Reuse the global Google session there.
  const initialProject = projectIdFromHash();
  if (initialProject && googleToken() && !adminToken()) {
    sessionStorage.setItem(`ucom.participant.${initialProject}`, googleToken());
  }

  function toast(message, error = false) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.className = `toast show ${error ? "error" : ""}`;
    setTimeout(() => { if (el.textContent === message) el.className = "toast"; }, 3200);
  }

  function xhr(method, path, token = "", body) {
    return new Promise((resolve, reject) => {
      const req = new XMLHttpRequest();
      req.open(method, `${API}${path}`, true);
      req.setRequestHeader("Accept", "application/json");
      if (body !== undefined) req.setRequestHeader("Content-Type", "application/json");
      if (token) req.setRequestHeader("Authorization", `Bearer ${token}`);
      req.onreadystatechange = () => {
        if (req.readyState !== 4) return;
        let data = {};
        try { data = req.responseText ? JSON.parse(req.responseText) : {}; } catch {}
        if (req.status >= 200 && req.status < 300) resolve(data);
        else reject(Object.assign(new Error(data.error || `HTTP ${req.status || 0}`), { status: req.status }));
      };
      req.onerror = () => reject(new Error("No se pudo conectar con el servidor"));
      req.send(body === undefined ? null : JSON.stringify(body));
    });
  }

  function xhrText(method, path, token = "") {
    return new Promise((resolve, reject) => {
      const req = new XMLHttpRequest();
      req.open(method, `${API}${path}`, true);
      req.setRequestHeader("Accept", "image/svg+xml,text/plain,*/*");
      if (token) req.setRequestHeader("Authorization", `Bearer ${token}`);
      req.onreadystatechange = () => {
        if (req.readyState !== 4) return;
        if (req.status >= 200 && req.status < 300) resolve(req.responseText || "");
        else reject(new Error(`HTTP ${req.status || 0}`));
      };
      req.onerror = () => reject(new Error("No se pudo conectar con el servidor"));
      req.send();
    });
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast("Copiado"); }
    catch { toast("No se pudo copiar", true); }
  }

  async function loadGoogleConfig(force = false) {
    if (googleConfig && !force) return googleConfig;
    googleConfig = await xhr("GET", "/api/auth/google/config-v11");
    return googleConfig;
  }

  function loadGoogleScript() {
    if (window.google?.accounts?.id) return Promise.resolve();
    if (googleScriptPromise) return googleScriptPromise;
    googleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("No se pudo cargar Google"));
      document.head.appendChild(script);
    });
    return googleScriptPromise;
  }

  async function ensureGoogleInitialized() {
    const config = await loadGoogleConfig();
    if (!config.configured || !config.client_id) return false;
    await loadGoogleScript();
    if (googleInitClient !== config.client_id) {
      window.google.accounts.id.initialize({
        client_id: config.client_id,
        callback: handleGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      googleInitClient = config.client_id;
    }
    return true;
  }

  async function renderGoogleButton(container, projectId = "") {
    if (!container) return;
    container.replaceChildren();
    try {
      if (!await ensureGoogleInitialized()) {
        container.innerHTML = '<span class="google-unavailable">Google pendiente</span>';
        return;
      }
      const arm = () => { pendingGoogleProject = projectId; };
      container.addEventListener("pointerdown", arm, { capture: true });
      container.addEventListener("focusin", arm, { capture: true });
      window.google.accounts.id.renderButton(container, {
        type: "standard",
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: 280,
      });
    } catch (error) {
      container.innerHTML = '<span class="google-unavailable">Google no disponible</span>';
    }
  }

  async function handleGoogleCredential(response) {
    const credential = response?.credential || "";
    if (!credential) return;
    const projectId = pendingGoogleProject;
    try {
      if (projectId) {
        const data = await xhr("POST", `/api/projects/${encodeURIComponent(projectId)}/google-login-v11`, "", { credential });
        localStorage.setItem(GOOGLE_KEY, data.token);
        sessionStorage.setItem(`ucom.participant.${projectId}`, data.token);
        $("#classJoinDialog")?.close();
        location.hash = `#/p/${encodeURIComponent(projectId)}`;
        toast(`Hola, ${data.user?.name || ""}`.trim());
      } else {
        const data = await xhr("POST", "/api/auth/google/session-v11", "", { credential });
        localStorage.setItem(GOOGLE_KEY, data.token);
        await renderStudentSpace();
      }
    } catch (error) {
      toast(error.message || "No se pudo ingresar con Google", true);
    }
  }

  function installStudentSpace() {
    if ($("#studentSpace")) return;
    const recent = $("#landing .recent-card");
    if (!recent) return;
    const section = document.createElement("section");
    section.id = "studentSpace";
    section.className = "student-space-v11";
    section.innerHTML = `
      <div class="student-space-head">
        <div><span class="eyebrow">Alumno</span><h3>Mis tareas</h3></div>
        <button id="googleStudentLogout" class="ghost hidden" type="button">Salir</button>
      </div>
      <div id="studentIdentity" class="student-identity-v11"></div>
      <div id="googleGlobalButton" class="google-button-v11"></div>
      <div id="studentTaskList" class="student-task-list-v11"></div>`;
    recent.before(section);
    $("#googleStudentLogout")?.addEventListener("click", googleLogout);
    $("#studentTaskList")?.addEventListener("click", event => {
      const button = event.target.closest("[data-google-project]");
      if (!button) return;
      const id = button.dataset.googleProject || "";
      const token = googleToken();
      if (!id || !token) return;
      sessionStorage.setItem(`ucom.participant.${id}`, token);
      location.hash = `#/p/${encodeURIComponent(id)}`;
    });
  }

  async function renderStudentSpace() {
    installStudentSpace();
    const identity = $("#studentIdentity");
    const tasks = $("#studentTaskList");
    const button = $("#googleGlobalButton");
    const logout = $("#googleStudentLogout");
    if (!identity || !tasks || !button) return;
    identity.textContent = "";
    tasks.replaceChildren();
    const token = googleToken();
    if (!token) {
      logout?.classList.add("hidden");
      await renderGoogleButton(button, "");
      return;
    }
    try {
      const data = await xhr("GET", "/api/google/me/tasks-v11", token);
      button.replaceChildren();
      logout?.classList.remove("hidden");
      identity.innerHTML = `<strong>${escapeHtml(data.user?.name || "")}</strong><span>${escapeHtml(data.user?.email || "")}</span>`;
      const projects = data.projects || [];
      if (!projects.length) {
        tasks.innerHTML = '<div class="student-empty-v11">Sin tareas activas.</div>';
        return;
      }
      tasks.innerHTML = projects.map(project => `
        <button class="student-task-v11" type="button" data-google-project="${escapeHtml(project.id)}">
          <span><strong>${escapeHtml(project.title || "Tarea")}</strong><small>${escapeHtml(project.subject || "")}</small></span>
          <time>${escapeHtml(formatDate(project.due_date))}</time>
        </button>`).join("");
    } catch (error) {
      if (error.status === 401) localStorage.removeItem(GOOGLE_KEY);
      logout?.classList.add("hidden");
      await renderGoogleButton(button, "");
    }
  }

  async function googleLogout() {
    const token = googleToken();
    if (token) xhr("POST", "/api/google/logout-v11", token).catch(() => {});
    localStorage.removeItem(GOOGLE_KEY);
    Object.keys(sessionStorage).filter(key => key.startsWith("ucom.participant.")).forEach(key => sessionStorage.removeItem(key));
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
    await renderStudentSpace();
  }

  function installGoogleAdminSetup() {
    const actions = $("#landing .hero-actions");
    if (!actions || $("#googleSetupBtn")) return;
    const button = document.createElement("button");
    button.id = "googleSetupBtn";
    button.type = "button";
    button.className = "ghost large hidden";
    button.textContent = "Google";
    button.addEventListener("click", openGoogleSetup);
    actions.appendChild(button);
    const state = $("#adminState");
    if (state) new MutationObserver(syncGoogleSetupVisibility).observe(state, { childList: true, subtree: true });
    syncGoogleSetupVisibility();
  }

  function syncGoogleSetupVisibility() {
    $("#googleSetupBtn")?.classList.toggle("hidden", !adminToken());
  }

  function ensureGoogleSetupDialog() {
    let dialog = $("#googleSetupDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "googleSetupDialog";
    dialog.innerHTML = `
      <form id="googleSetupForm" class="dialog-card google-setup-card-v11">
        <div class="dialog-head"><div><h2>Google</h2></div><button type="button" class="icon-btn google-setup-close">×</button></div>
        <label>Client ID<input name="client_id" autocomplete="off" placeholder="000000000000-xxxxx.apps.googleusercontent.com"></label>
        <div id="googleSetupState" class="google-setup-state-v11"></div>
        <button class="primary" type="submit">Guardar</button>
      </form>`;
    document.body.appendChild(dialog);
    $(".google-setup-close", dialog)?.addEventListener("click", () => dialog.close());
    $("#googleSetupForm", dialog)?.addEventListener("submit", saveGoogleSetup);
    return dialog;
  }

  async function openGoogleSetup() {
    const dialog = ensureGoogleSetupDialog();
    try {
      const data = await xhr("GET", "/api/admin/google-config-v11", adminToken());
      dialog.querySelector('[name="client_id"]').value = data.client_id || "";
      $("#googleSetupState", dialog).textContent = data.configured ? "Configurado" : "Sin configurar";
      dialog.showModal();
    } catch (error) { toast(error.message, true); }
  }

  async function saveGoogleSetup(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const clientId = new FormData(form).get("client_id")?.toString().trim() || "";
    try {
      await xhr("PUT", "/api/admin/google-config-v11", adminToken(), { client_id: clientId });
      googleConfig = null;
      toast("Google configurado");
      form.closest("dialog")?.close();
      location.reload();
    } catch (error) { toast(error.message, true); }
  }

  function installCreateAccess() {
    const bottom = $("#createDialog .create-bottom-grid");
    if (!bottom || $("#createAuthV11")) return;
    const section = document.createElement("div");
    section.id = "createAuthV11";
    section.className = "create-auth-v11";
    section.innerHTML = `
      <div class="create-auth-head-v11"><span>Acceso de alumnos</span></div>
      <div class="create-auth-grid-v11">
        <label>Google
          <select id="createGoogleMode">
            <option value="all" selected>Todos los correos Google</option>
            <option value="domains">Sólo dominios permitidos</option>
            <option value="off">Desactivado</option>
          </select>
        </label>
        <label id="createDomainsWrap" class="hidden">Dominios<input id="createAllowedDomains" placeholder="ucom.com.py"></label>
        <label class="code-toggle-v11"><input id="createCodeEnabled" type="checkbox" checked><span>Código de 4 dígitos</span></label>
      </div>`;
    bottom.after(section);
    $("#createGoogleMode")?.addEventListener("change", syncCreateDomains);
    syncCreateDomains();
  }

  function syncCreateDomains() {
    $("#createDomainsWrap")?.classList.toggle("hidden", $("#createGoogleMode")?.value !== "domains");
  }

  function selectedCreateType() {
    return $('#createForm input[name="work_type"]:checked')?.value || "group";
  }

  function createCount() {
    return selectedCreateType() === "individual" ? 1 : Math.max(2, Math.min(30, Number($("#createMaxMembers")?.value) || 4));
  }

  function showCreateError(message) {
    const box = $("#createError");
    if (!box) return;
    box.textContent = message;
    box.classList.remove("hidden");
  }

  async function createTask(event) {
    const form = $("#createForm");
    if (!form || event.target !== form) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!form.reportValidity()) return;
    const token = adminToken();
    if (!token) { showCreateError("Sesión de administrador requerida"); return; }
    const fd = new FormData(form);
    const due = String(fd.get("due_date") || "").trim();
    if (!due || Number.isNaN(new Date(due).getTime()) || new Date(due).getTime() <= Date.now()) {
      showCreateError("La entrega debe ser futura");
      return;
    }
    const mode = $("#createGoogleMode")?.value || "all";
    const domains = $("#createAllowedDomains")?.value || "";
    const codeEnabled = !!$("#createCodeEnabled")?.checked;
    if (mode === "domains" && !domains.trim()) { showCreateError("Indicá el dominio permitido"); return; }

    const button = form.querySelector('button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = "Creando…"; }
    let id = "";
    try {
      const created = await xhr("POST", "/api/projects", token, {
        subject: String(fd.get("subject") || ""), title: String(fd.get("title") || ""), professor: String(fd.get("professor") || ""),
        class_date: due.slice(0, 10), due_date: due, work_type: selectedCreateType(), members: [], directives: "", content: "", template: "ucom", access_mode: "24h",
      });
      id = created.project?.id || "";
      if (!id) throw new Error("No se generó la tarea");
      await xhr("PUT", `/api/projects/${encodeURIComponent(id)}/settings`, token, { project_end_at: due, max_members: createCount() });
      await xhr("PUT", `/api/projects/${encodeURIComponent(id)}/auth-policy-v11`, token, { google_mode: mode, allowed_domains: domains, code_enabled: codeEnabled });
      $("#createDialog")?.close();
      form.reset();
      syncCreateDomains();
      location.hash = `#/p/${encodeURIComponent(id)}`;
      setTimeout(() => showShare(id), 450);
      toast("Tarea creada");
    } catch (error) {
      if (id) xhr("DELETE", `/api/admin/projects/${encodeURIComponent(id)}`, token).catch(() => {});
      showCreateError(error.message || "No se pudo crear la tarea");
    } finally {
      if (button) { button.disabled = false; button.textContent = "Crear tarea"; }
    }
  }

  async function showShare(projectId) {
    if (!adminToken() || !projectId) return;
    pendingShareProject = projectId;
    try {
      const data = await xhr("GET", `/api/projects/${encodeURIComponent(projectId)}/auth-policy-v11`, adminToken());
      renderShareDialog(projectId, data);
    } catch (error) { toast(error.message || "No se pudo abrir Compartir", true); }
  }

  async function renderShareDialog(projectId, data) {
    const dialog = $("#accessDialog");
    const card = dialog?.querySelector(".share-dialog");
    if (!dialog || !card) return;
    const domains = (data.allowed_domains || []).join(", ");
    const participants = data.participants || [];
    const link = data.class_url || `${location.origin}${location.pathname}#/class/${encodeURIComponent(projectId)}`;
    card.innerHTML = `
      <div class="dialog-head"><div><h2>Compartir tarea</h2><span class="share-count-v11">${data.member_count || 0}/${data.max_members || 0}</span></div><button type="button" class="icon-btn share-close-v11">×</button></div>
      <div class="share-main-v11">
        <div id="shareQrV11" class="share-qr-v11"></div>
        <div class="share-link-v11"><code>${escapeHtml(link)}</code><button class="ghost copy-link-v11" type="button">Copiar enlace</button></div>
      </div>
      <div class="share-policy-v11">
        <label>Google
          <select id="shareGoogleModeV11">
            <option value="all" ${data.google_mode === "all" ? "selected" : ""}>Todos</option>
            <option value="domains" ${data.google_mode === "domains" ? "selected" : ""}>Dominios</option>
            <option value="off" ${data.google_mode === "off" ? "selected" : ""}>Desactivado</option>
          </select>
        </label>
        <label id="shareDomainsWrapV11" class="${data.google_mode === "domains" ? "" : "hidden"}">Dominios<input id="shareDomainsV11" value="${escapeHtml(domains)}" placeholder="ucom.com.py"></label>
        <label class="code-toggle-v11"><input id="shareCodeEnabledV11" type="checkbox" ${data.code_enabled ? "checked" : ""}><span>Código de respaldo</span></label>
      </div>
      <div class="share-code-v11 ${data.code_enabled ? "" : "hidden"}">
        <span>Código</span><button id="shareCodeV11" class="share-code-value-v11" type="button">${escapeHtml(data.code || "----")}</button><button id="regenCodeV11" class="ghost" type="button">Nuevo</button>
      </div>
      ${!data.google_configured && data.google_mode !== "off" ? '<div class="google-not-configured-v11">Google pendiente de configurar</div>' : ""}
      <div class="share-actions-v11"><button id="savePolicyV11" class="primary" type="button">Guardar acceso</button></div>
      <div class="participants-v11">
        <div class="participants-head-v11"><strong>Integrantes</strong><span>${participants.length}</span></div>
        <div class="participants-list-v11">
          ${participants.map(item => `<div class="participant-v11"><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.email)}</small></span><button class="ghost remove-participant-v11" data-sub="${escapeHtml(item.google_sub)}" type="button">Quitar</button></div>`).join("") || '<div class="student-empty-v11">Todavía no ingresó nadie con Google.</div>'}
        </div>
      </div>`;

    $(".share-close-v11", card)?.addEventListener("click", () => dialog.close());
    $(".copy-link-v11", card)?.addEventListener("click", () => copyText(link));
    $("#shareCodeV11", card)?.addEventListener("click", () => copyText($("#shareCodeV11", card)?.textContent || ""));
    $("#shareGoogleModeV11", card)?.addEventListener("change", () => $("#shareDomainsWrapV11", card)?.classList.toggle("hidden", $("#shareGoogleModeV11", card)?.value !== "domains"));
    $("#shareCodeEnabledV11", card)?.addEventListener("change", () => $(".share-code-v11", card)?.classList.toggle("hidden", !$("#shareCodeEnabledV11", card)?.checked));
    $("#savePolicyV11", card)?.addEventListener("click", () => saveSharePolicy(projectId, false));
    $("#regenCodeV11", card)?.addEventListener("click", () => saveSharePolicy(projectId, true));
    card.querySelectorAll(".remove-participant-v11").forEach(button => button.addEventListener("click", () => removeParticipant(projectId, button.dataset.sub || "")));
    try {
      const svg = await xhrText("GET", `/api/projects/${encodeURIComponent(projectId)}/class-qr-v11`, adminToken());
      const target = $("#shareQrV11", card); if (target) target.innerHTML = svg;
    } catch {}
    if (!dialog.open) dialog.showModal();
  }

  async function saveSharePolicy(projectId, regenerate) {
    const card = $("#accessDialog .share-dialog");
    if (!card) return;
    const mode = $("#shareGoogleModeV11", card)?.value || "all";
    const domains = $("#shareDomainsV11", card)?.value || "";
    const codeEnabled = !!$("#shareCodeEnabledV11", card)?.checked;
    try {
      const data = await xhr("PUT", `/api/projects/${encodeURIComponent(projectId)}/auth-policy-v11`, adminToken(), { google_mode: mode, allowed_domains: domains, code_enabled: codeEnabled, regenerate_code: regenerate });
      await renderShareDialog(projectId, data);
      toast(regenerate ? "Código nuevo" : "Acceso guardado");
    } catch (error) { toast(error.message, true); }
  }

  async function removeParticipant(projectId, sub) {
    if (!sub || !confirm("¿Quitar a este integrante de la tarea?")) return;
    try {
      await xhr("DELETE", `/api/projects/${encodeURIComponent(projectId)}/participants-v11/${encodeURIComponent(sub)}`, adminToken());
      await showShare(projectId);
      toast("Integrante quitado");
    } catch (error) { toast(error.message, true); }
  }

  function installAccessCapture() {
    $("#accessBtn")?.addEventListener("click", event => {
      if (!adminToken()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      showShare(projectIdFromHash());
    }, true);
  }

  function ensureClassDialog() {
    let dialog = $("#classJoinDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "classJoinDialog";
    dialog.className = "class-join-dialog-v11";
    document.body.appendChild(dialog);
    return dialog;
  }

  async function openClassRoute(projectId) {
    if (!projectId) return;
    const dialog = ensureClassDialog();
    try {
      const info = await xhr("GET", `/api/projects/${encodeURIComponent(projectId)}/join-info-v11`);
      let known = null;
      const token = googleToken();
      if (token) {
        try { known = await xhr("GET", "/api/google/me/tasks-v11", token); }
        catch (error) { if (error.status === 401) localStorage.removeItem(GOOGLE_KEY); }
      }
      dialog.innerHTML = `
        <div class="dialog-card class-join-card-v11">
          <div class="dialog-head"><div><span class="eyebrow">${escapeHtml(info.subject || "UCOM")}</span><h2>${escapeHtml(info.title || "Tarea")}</h2></div><button type="button" class="icon-btn class-close-v11">×</button></div>
          <div class="class-capacity-v11">${info.member_count || 0}/${info.max_members || 0}</div>
          <div id="classGoogleAreaV11" class="class-google-area-v11"></div>
          ${info.code_enabled ? `<div class="class-code-divider-v11"><span>o código</span></div><form id="classCodeFormV11" class="class-code-form-v11"><input name="code" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="0000" required><input name="name" maxlength="120" placeholder="Nombre y apellido" required><button class="primary" type="submit">Entrar</button></form>` : ""}
        </div>`;
      $(".class-close-v11", dialog)?.addEventListener("click", () => { dialog.close(); history.replaceState(null, "", location.pathname); });
      $("#classCodeFormV11", dialog)?.addEventListener("submit", event => joinClassCode(event, projectId));
      const googleArea = $("#classGoogleAreaV11", dialog);
      if (info.google_mode !== "off") {
        if (known?.user && googleToken()) {
          googleArea.innerHTML = `<button id="continueGoogleV11" class="google-known-v11" type="button"><strong>${escapeHtml(known.user.name)}</strong><span>${escapeHtml(known.user.email)}</span></button><div id="differentGoogleV11" class="google-button-v11"></div>`;
          $("#continueGoogleV11", googleArea)?.addEventListener("click", () => joinWithExistingGoogle(projectId));
          await renderGoogleButton($("#differentGoogleV11", googleArea), projectId);
        } else {
          await renderGoogleButton(googleArea, projectId);
        }
      }
      if (!dialog.open) dialog.showModal();
    } catch (error) { toast(error.message || "No se pudo abrir la tarea", true); }
  }

  async function joinWithExistingGoogle(projectId) {
    const token = googleToken();
    if (!token) return;
    try {
      await xhr("POST", `/api/projects/${encodeURIComponent(projectId)}/google-join-session-v11`, token, {});
      sessionStorage.setItem(`ucom.participant.${projectId}`, token);
      $("#classJoinDialog")?.close();
      location.hash = `#/p/${encodeURIComponent(projectId)}`;
    } catch (error) { toast(error.message, true); }
  }

  async function joinClassCode(event, projectId) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    try {
      const data = await xhr("POST", `/api/projects/${encodeURIComponent(projectId)}/join-code-v11`, "", { code: String(fd.get("code") || ""), name: String(fd.get("name") || "") });
      sessionStorage.setItem(`ucom.participant.${projectId}`, data.token);
      $("#classJoinDialog")?.close();
      location.hash = `#/p/${encodeURIComponent(projectId)}`;
    } catch (error) { toast(error.message, true); }
  }

  function enhanceLegacyMemberDialog() {
    const form = $("#memberForm");
    if (!form) return;
    const project = form.elements.project_id;
    const password = form.elements.password;
    const name = form.elements.name;
    if (password) { password.placeholder = "0000"; password.inputMode = "numeric"; password.maxLength = 4; }
    if (name) name.required = true;
    form.addEventListener("submit", async event => {
      const code = String(password?.value || "").trim();
      if (!/^\d{4}$/.test(code)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const id = String(project?.value || "").trim();
      if (!id) return;
      try {
        const data = await xhr("POST", `/api/projects/${encodeURIComponent(id)}/join-code-v11`, "", { code, name: name?.value || "" });
        sessionStorage.setItem(`ucom.participant.${id}`, data.token);
        form.closest("dialog")?.close();
        location.hash = `#/p/${encodeURIComponent(id)}`;
      } catch (error) { toast(error.message, true); }
    }, true);
  }

  function formatDate(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("es-PY", { dateStyle: "short", timeStyle: "short" });
  }

  function syncClassRoute() {
    const id = classIdFromHash();
    if (id) openClassRoute(id);
  }

  function init() {
    installStudentSpace();
    installGoogleAdminSetup();
    installCreateAccess();
    installAccessCapture();
    enhanceLegacyMemberDialog();
    $("#createForm")?.addEventListener("submit", createTask, true);
    renderStudentSpace();
    syncClassRoute();
    window.addEventListener("hashchange", () => {
      const id = projectIdFromHash();
      if (id && googleToken() && !adminToken()) sessionStorage.setItem(`ucom.participant.${id}`, googleToken());
      syncClassRoute();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
