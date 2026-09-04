(() => {
  "use strict";

  const API_BASE = "https://ucom-api.ufotech.com.py";
  const RECENTS_KEY = "ucom.workspace.recents.v1";

  const state = {
    project: null,
    access: null,
    token: "",
    shareId: "",
    dirty: false,
    selectedRevision: null,
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const els = {
    landing: $("#landing"),
    workspace: $("#workspace"),
    recentProjects: $("#recentProjects"),
    newProjectBtn: $("#newProjectBtn"),
    openSharedBtn: $("#openSharedBtn"),
    backBtn: $("#backBtn"),
    workspaceTitle: $("#workspaceTitle"),
    accessBadge: $("#accessBadge"),
    saveState: $("#saveState"),
    saveBtn: $("#saveBtn"),
    shareBtn: $("#shareBtn"),
    historyBtn: $("#historyBtn"),
    exportBtn: $("#exportBtn"),
    subject: $("#subjectInput"),
    title: $("#titleInput"),
    professor: $("#professorInput"),
    classDate: $("#classDateInput"),
    dueDate: $("#dueDateInput"),
    workType: $("#workTypeInput"),
    members: $("#membersInput"),
    directives: $("#directivesInput"),
    content: $("#contentInput"),
    template: $("#templateInput"),
    preview: $("#previewPaper"),
    toast: $("#toast"),
    createDialog: $("#createDialog"),
    createForm: $("#createForm"),
    sharedDialog: $("#sharedDialog"),
    sharedForm: $("#sharedForm"),
    shareDialog: $("#shareDialog"),
    shareForm: $("#shareForm"),
    shareList: $("#shareList"),
    newShareResult: $("#newShareResult"),
    generatePasswordBtn: $("#generatePasswordBtn"),
    historyDialog: $("#historyDialog"),
    historyList: $("#historyList"),
    versionDialog: $("#versionDialog"),
    versionTitle: $("#versionTitle"),
    versionContent: $("#versionContent"),
    restoreVersionBtn: $("#restoreVersionBtn"),
    ownerKeyDialog: $("#ownerKeyDialog"),
    ownerKeyText: $("#ownerKeyText"),
    copyOwnerKeyBtn: $("#copyOwnerKeyBtn"),
    ownerKeyDoneBtn: $("#ownerKeyDoneBtn"),
  };

  function ownerStorageKey(projectId) {
    return `ucom.owner.${projectId}`;
  }

  function sessionStorageKey(projectId, shareId) {
    return `ucom.session.${projectId}.${shareId}`;
  }

  function unsavedStorageKey(projectId) {
    return `ucom.unsaved.${projectId}`;
  }

  function readRecents() {
    try {
      const data = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function writeRecents(items) {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(items.slice(0, 20)));
  }

  function rememberRecent(project, role = "owner", shareId = "") {
    const items = readRecents().filter((item) => item.id !== project.id || item.shareId !== shareId);
    items.unshift({
      id: project.id,
      title: project.title || "Proyecto sin título",
      subject: project.subject || "",
      updatedAt: project.updated_at || new Date().toISOString(),
      role,
      shareId,
    });
    writeRecents(items);
    renderRecents();
  }

  function forgetRecent(projectId, shareId = "") {
    writeRecents(readRecents().filter((item) => item.id !== projectId || item.shareId !== shareId));
    renderRecents();
  }

  function renderRecents() {
    const items = readRecents();
    if (!items.length) {
      els.recentProjects.innerHTML = `<div class="empty-state">Todavía no hay proyectos guardados en este navegador.</div>`;
      return;
    }

    els.recentProjects.innerHTML = items.map((item) => {
      const role = item.role === "owner" ? "Propietario" : "Compartido";
      const route = item.shareId ? `#/p/${encodeURIComponent(item.id)}/s/${encodeURIComponent(item.shareId)}` : `#/p/${encodeURIComponent(item.id)}`;
      return `
        <div class="recent-item">
          <div>
            <strong>${escapeHtml(item.title || "Proyecto")}</strong>
            <small>${escapeHtml(item.subject || "Sin materia")} · ${role}</small>
          </div>
          <button class="ghost recent-open" data-route="${route}">Abrir</button>
        </div>
      `;
    }).join("");
  }

  function toast(message, type = "info") {
    els.toast.textContent = message;
    els.toast.className = `toast show ${type === "error" ? "error" : ""}`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
      els.toast.className = "toast";
    }, 3600);
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      cache: "no-store",
    });

    let data = null;
    const text = await response.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { ok: false, error: text || `HTTP ${response.status}` };
    }

    if (!response.ok) {
      const error = new Error(data.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function authHeaders(token = state.token) {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function parseRoute(hash = location.hash) {
    const match = hash.match(/^#\/p\/([^/]+)(?:\/s\/([^/]+))?\/?$/);
    if (!match) return null;
    return {
      projectId: decodeURIComponent(match[1]),
      shareId: match[2] ? decodeURIComponent(match[2]) : "",
    };
  }

  function showLanding() {
    state.project = null;
    state.access = null;
    state.token = "";
    state.shareId = "";
    state.dirty = false;
    els.workspace.classList.add("hidden");
    els.landing.classList.remove("hidden");
    document.title = "UCOM Workspace";
    renderRecents();
  }

  function showWorkspace() {
    els.landing.classList.add("hidden");
    els.workspace.classList.remove("hidden");
  }

  function setSaveState(kind, text) {
    els.saveState.className = `save-state ${kind}`;
    els.saveState.textContent = text;
  }

  function setDirty(value = true) {
    state.dirty = value;
    if (value) {
      setSaveState("dirty", "Sin guardar");
      if (state.project) {
        try {
          localStorage.setItem(unsavedStorageKey(state.project.id), JSON.stringify(gatherDraft()));
        } catch {}
      }
    } else {
      setSaveState("saved", "Guardado");
      if (state.project) localStorage.removeItem(unsavedStorageKey(state.project.id));
    }
  }

  function splitMembers(text) {
    return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }

  function gatherDraft() {
    return {
      subject: els.subject.value,
      title: els.title.value,
      professor: els.professor.value,
      class_date: els.classDate.value,
      due_date: els.dueDate.value,
      work_type: els.workType.value,
      members: splitMembers(els.members.value),
      directives: els.directives.value,
      content: els.content.value,
      template: els.template.value,
    };
  }

  function applyProject(project) {
    state.project = project;
    els.subject.value = project.subject || "";
    els.title.value = project.title || "";
    els.professor.value = project.professor || "";
    els.classDate.value = normalizeDateInput(project.class_date);
    els.dueDate.value = normalizeDateTimeInput(project.due_date);
    els.workType.value = project.work_type || "group";
    els.members.value = (project.members || []).join("\n");
    els.directives.value = project.directives || "";
    els.content.value = project.content || "";
    els.template.value = project.template || "ucom";
    els.workspaceTitle.textContent = project.title || "Proyecto";
    document.title = `${project.title || "Proyecto"} · UCOM Workspace`;
    setDirty(false);
    renderPreview();
  }

  function applyDraft(draft) {
    if (!draft || typeof draft !== "object") return;
    els.subject.value = draft.subject || "";
    els.title.value = draft.title || "";
    els.professor.value = draft.professor || "";
    els.classDate.value = normalizeDateInput(draft.class_date);
    els.dueDate.value = normalizeDateTimeInput(draft.due_date);
    els.workType.value = draft.work_type || "group";
    els.members.value = Array.isArray(draft.members) ? draft.members.join("\n") : "";
    els.directives.value = draft.directives || "";
    els.content.value = draft.content || "";
    els.template.value = draft.template || "ucom";
    els.workspaceTitle.textContent = draft.title || "Proyecto";
    setDirty(true);
    renderPreview();
  }

  function restoreLocalDraftIfAny(projectId) {
    const raw = localStorage.getItem(unsavedStorageKey(projectId));
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      const restore = confirm("Hay un borrador local sin guardar para este proyecto. ¿Querés recuperarlo?");
      if (restore) {
        applyDraft(draft);
        toast("Borrador local recuperado");
      } else {
        localStorage.removeItem(unsavedStorageKey(projectId));
      }
    } catch {
      localStorage.removeItem(unsavedStorageKey(projectId));
    }
  }

  function normalizeDateInput(value) {
    if (!value) return "";
    return String(value).slice(0, 10);
  }

  function normalizeDateTimeInput(value) {
    if (!value) return "";
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) return text.slice(0, 16);
    return "";
  }

  function applyAccess(access) {
    state.access = access;
    const owner = access?.role === "owner";
    const editable = owner || access?.permission === "edit";

    els.accessBadge.textContent = owner
      ? "Propietario"
      : access?.permission === "edit"
        ? `${access.actor_name || "Participante"} · edición`
        : `${access.actor_name || "Participante"} · lectura`;

    $$(".owner-only").forEach((node) => {
      node.classList.toggle("hidden", !owner);
    });

    [
      els.subject, els.title, els.professor, els.classDate, els.dueDate,
      els.workType, els.members, els.directives, els.content, els.template,
    ].forEach((control) => {
      control.disabled = !editable;
    });

    els.saveBtn.classList.toggle("hidden", !editable);
  }

  async function openProject(projectId, token, shareId = "") {
    try {
      const data = await api(`/api/projects/${encodeURIComponent(projectId)}`, {
        headers: authHeaders(token),
      });
      state.token = token;
      state.shareId = shareId;
      showWorkspace();
      applyProject(data.project);
      applyAccess(data.access);
      restoreLocalDraftIfAny(data.project.id);
      rememberRecent(data.project, data.access.role, shareId);
    } catch (error) {
      if (error.status === 401 && shareId) {
        localStorage.removeItem(sessionStorageKey(projectId, shareId));
        openSharedDialog(projectId, shareId);
        return;
      }
      toast(error.message || "No se pudo abrir el proyecto", "error");
      showLanding();
    }
  }

  async function routeFromLocation() {
    const route = parseRoute();
    if (!route) {
      showLanding();
      return;
    }

    if (route.shareId) {
      const session = localStorage.getItem(sessionStorageKey(route.projectId, route.shareId)) || "";
      if (session) {
        await openProject(route.projectId, session, route.shareId);
      } else {
        showLanding();
        openSharedDialog(route.projectId, route.shareId);
      }
      return;
    }

    const ownerToken = localStorage.getItem(ownerStorageKey(route.projectId)) || "";
    if (ownerToken) {
      await openProject(route.projectId, ownerToken);
      return;
    }

    showLanding();
    openSharedDialog(route.projectId, "");
    toast("Este navegador no tiene la clave de propietario para ese proyecto.", "error");
  }

  async function createProject(event) {
    event.preventDefault();
    const form = new FormData(els.createForm);
    const payload = {
      subject: form.get("subject") || "",
      title: form.get("title") || "",
      professor: form.get("professor") || "",
      class_date: form.get("class_date") || "",
      due_date: form.get("due_date") || "",
      work_type: form.get("work_type") || "group",
      members: splitMembers(String(form.get("members") || "")),
      directives: "",
      content: "",
      template: "ucom",
    };

    try {
      const data = await api("/api/projects", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      localStorage.setItem(ownerStorageKey(data.project.id), data.owner_token);
      rememberRecent(data.project, "owner", "");
      els.createDialog.close();
      els.createForm.reset();

      els.ownerKeyText.textContent = data.owner_token;
      els.ownerKeyDialog.showModal();

      history.replaceState(null, "", `#/p/${encodeURIComponent(data.project.id)}`);
      state.token = data.owner_token;
      showWorkspace();
      applyProject(data.project);
      applyAccess({ role: "owner", permission: "edit", actor_name: "Propietario" });
    } catch (error) {
      toast(error.message || "No se pudo crear el proyecto", "error");
    }
  }

  async function saveProject() {
    if (!state.project || !state.token || !state.dirty) return;

    const draft = gatherDraft();
    setSaveState("saving", "Guardando…");
    els.saveBtn.disabled = true;

    try {
      const data = await api(`/api/projects/${encodeURIComponent(state.project.id)}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          ...draft,
          expected_revision: state.project.revision,
        }),
      });

      applyProject(data.project);
      applyAccess(data.access);
      rememberRecent(data.project, data.access.role, state.shareId);
      toast(`Guardado · revisión ${data.project.revision}`);
    } catch (error) {
      if (error.status === 409 && error.data?.project) {
        try {
          localStorage.setItem(unsavedStorageKey(state.project.id), JSON.stringify(draft));
        } catch {}
        setSaveState("dirty", "Conflicto");
        const reload = confirm(
          "Hay una versión más nueva guardada por otra persona. Tu borrador quedó guardado en este navegador.\n\n¿Querés cargar ahora la versión del servidor?"
        );
        if (reload) {
          applyProject(error.data.project);
          try {
            localStorage.setItem(unsavedStorageKey(state.project.id), JSON.stringify(draft));
          } catch {}
          toast("Se cargó la versión más reciente. Tu borrador local quedó guardado para recuperarlo.", "error");
        }
      } else {
        setSaveState("dirty", "Error");
        toast(error.message || "No se pudo guardar", "error");
      }
    } finally {
      els.saveBtn.disabled = false;
    }
  }

  function openSharedDialog(projectId = "", shareId = "") {
    els.sharedForm.reset();
    els.sharedForm.elements.project_id.value = projectId;
    els.sharedForm.elements.share_id.value = shareId;
    if (projectId && shareId) {
      els.sharedForm.elements.share_url.value =
        `${location.origin}${location.pathname}#/p/${encodeURIComponent(projectId)}/s/${encodeURIComponent(shareId)}`;
    }
    els.sharedDialog.showModal();
  }

  function parseSharedUrl(value) {
    if (!value) return null;
    try {
      const url = new URL(value, location.href);
      return parseRoute(url.hash);
    } catch {
      return null;
    }
  }

  async function sharedLogin(event) {
    event.preventDefault();
    const form = new FormData(els.sharedForm);
    const parsed = parseSharedUrl(String(form.get("share_url") || ""));
    const projectId = parsed?.projectId || String(form.get("project_id") || "").trim();
    const shareId = parsed?.shareId || String(form.get("share_id") || "").trim();
    const ownerKey = String(form.get("owner_key") || "").trim();

    if (!projectId) {
      toast("Falta el identificador del proyecto.", "error");
      return;
    }

    if (ownerKey) {
      try {
        const data = await api(`/api/projects/${encodeURIComponent(projectId)}`, {
          headers: authHeaders(ownerKey),
        });
        if (data.access.role !== "owner") throw new Error("La clave no es de propietario");
        localStorage.setItem(ownerStorageKey(projectId), ownerKey);
        els.sharedDialog.close();
        history.replaceState(null, "", `#/p/${encodeURIComponent(projectId)}`);
        await openProject(projectId, ownerKey);
      } catch (error) {
        toast(error.message || "Clave de propietario inválida", "error");
      }
      return;
    }

    const name = String(form.get("name") || "").trim();
    const password = String(form.get("password") || "");

    if (!shareId || !name || !password) {
      toast("Para acceso compartido faltan enlace, nombre o contraseña.", "error");
      return;
    }

    try {
      const data = await api(`/api/projects/${encodeURIComponent(projectId)}/access`, {
        method: "POST",
        body: JSON.stringify({
          share_id: shareId,
          name,
          password,
        }),
      });
      localStorage.setItem(sessionStorageKey(projectId, shareId), data.session_token);
      els.sharedDialog.close();
      history.replaceState(null, "", `#/p/${encodeURIComponent(projectId)}/s/${encodeURIComponent(shareId)}`);
      await openProject(projectId, data.session_token, shareId);
    } catch (error) {
      toast(error.message || "No se pudo acceder", "error");
    }
  }

  function generatePassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const bytes = new Uint32Array(14);
    crypto.getRandomValues(bytes);
    return [...bytes].map((value) => alphabet[value % alphabet.length]).join("");
  }

  function shareExpiry(kind) {
    const now = Date.now();
    if (kind === "1h") return new Date(now + 60 * 60 * 1000).toISOString();
    if (kind === "6h") return new Date(now + 6 * 60 * 60 * 1000).toISOString();
    if (kind === "24h") return new Date(now + 24 * 60 * 60 * 1000).toISOString();
    if (kind === "deadline") {
      if (!els.dueDate.value) throw new Error("El proyecto no tiene fecha/hora de entrega.");
      const date = new Date(els.dueDate.value);
      if (Number.isNaN(date.getTime())) throw new Error("La fecha de entrega no es válida.");
      if (date.getTime() <= now) throw new Error("La fecha de entrega ya pasó.");
      return date.toISOString();
    }
    return null;
  }

  async function createShare(event) {
    event.preventDefault();
    if (!state.project) return;
    const form = new FormData(els.shareForm);
    const password = String(form.get("password") || "");
    const permission = String(form.get("permission") || "edit");
    const expiryKind = String(form.get("expiry") || "24h");

    let expiresAt = null;
    try {
      expiresAt = shareExpiry(expiryKind);
    } catch (error) {
      toast(error.message, "error");
      return;
    }

    try {
      const data = await api(`/api/projects/${encodeURIComponent(state.project.id)}/shares`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          password,
          permission,
          expires_at: expiresAt,
        }),
      });

      const link = `${location.origin}${location.pathname}#/p/${encodeURIComponent(state.project.id)}/s/${encodeURIComponent(data.share.id)}`;
      els.newShareResult.classList.remove("hidden");
      els.newShareResult.innerHTML = `
        <div><span class="eyebrow">Enlace</span><code>${escapeHtml(link)}</code></div>
        <div><span class="eyebrow">Contraseña</span><code>${escapeHtml(password)}</code></div>
        <button class="ghost copy-share" data-link="${escapeAttr(link)}" data-password="${escapeAttr(password)}">Copiar enlace + contraseña</button>
      `;
      els.shareForm.elements.password.value = "";
      await loadShares();
      toast("Acceso creado");
    } catch (error) {
      toast(error.message || "No se pudo crear el acceso", "error");
    }
  }

  async function loadShares() {
    if (!state.project || state.access?.role !== "owner") return;
    try {
      const data = await api(`/api/projects/${encodeURIComponent(state.project.id)}/shares`, {
        headers: authHeaders(),
      });

      if (!data.shares.length) {
        els.shareList.innerHTML = `<div class="empty-state">No hay accesos compartidos.</div>`;
        return;
      }

      els.shareList.innerHTML = data.shares.map((share) => {
        const expiry = share.expires_at ? formatDateTime(share.expires_at) : "Hasta revocar";
        const status = share.active ? "Activo" : share.revoked ? "Revocado" : "Expirado";
        const permission = share.permission === "edit" ? "Edición" : "Lectura";
        return `
          <div class="share-item">
            <div>
              <strong>${permission} · ${status}</strong>
              <small>${expiry} · ${escapeHtml(share.id)}</small>
            </div>
            ${share.active ? `<button class="danger-btn revoke-share" data-id="${escapeAttr(share.id)}">Revocar</button>` : ""}
          </div>
        `;
      }).join("");
    } catch (error) {
      toast(error.message || "No se pudieron cargar los accesos", "error");
    }
  }

  async function revokeShare(shareId) {
    if (!confirm("¿Revocar este acceso? Las sesiones asociadas dejarán de funcionar.")) return;
    try {
      await api(`/api/projects/${encodeURIComponent(state.project.id)}/shares/${encodeURIComponent(shareId)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      await loadShares();
      toast("Acceso revocado");
    } catch (error) {
      toast(error.message || "No se pudo revocar", "error");
    }
  }

  async function loadHistory() {
    if (!state.project) return;
    els.historyDialog.showModal();
    els.historyList.innerHTML = `<div class="empty-state">Cargando…</div>`;
    try {
      const data = await api(`/api/projects/${encodeURIComponent(state.project.id)}/versions`, {
        headers: authHeaders(),
      });
      els.historyList.innerHTML = data.versions.map((version) => `
        <div class="history-item">
          <div>
            <strong>Revisión ${version.revision}</strong>
            <small>${escapeHtml(version.actor_name)} · ${formatDateTime(version.created_at)}</small>
          </div>
          <button class="ghost view-version" data-revision="${version.revision}">Ver</button>
        </div>
      `).join("") || `<div class="empty-state">Sin versiones.</div>`;
    } catch (error) {
      els.historyList.innerHTML = `<div class="empty-state">No se pudo cargar el historial.</div>`;
      toast(error.message || "Error de historial", "error");
    }
  }

  async function viewVersion(revision) {
    try {
      const data = await api(
        `/api/projects/${encodeURIComponent(state.project.id)}/versions/${encodeURIComponent(revision)}`,
        { headers: authHeaders() }
      );
      state.selectedRevision = revision;
      els.versionTitle.textContent = `Revisión ${revision}`;
      const snap = data.version.snapshot;
      els.versionContent.textContent = [
        `${snap.subject || ""} · ${snap.title || ""}`,
        `Profesor/a: ${snap.professor || "—"}`,
        `Integrantes: ${(snap.members || []).join(", ") || "—"}`,
        "",
        "CONSIGNA",
        snap.directives || "—",
        "",
        "CONTENIDO",
        snap.content || "—",
      ].join("\n");
      els.restoreVersionBtn.classList.toggle("hidden", state.access?.role !== "owner");
      els.versionDialog.showModal();
    } catch (error) {
      toast(error.message || "No se pudo abrir la versión", "error");
    }
  }

  async function restoreVersion() {
    if (!state.selectedRevision || state.access?.role !== "owner") return;
    if (!confirm(`¿Restaurar la revisión ${state.selectedRevision}? La versión actual seguirá en el historial.`)) return;
    try {
      const data = await api(
        `/api/projects/${encodeURIComponent(state.project.id)}/versions/${state.selectedRevision}/restore`,
        {
          method: "POST",
          headers: authHeaders(),
        }
      );
      applyProject(data.project);
      els.versionDialog.close();
      els.historyDialog.close();
      toast(`Restaurada como revisión ${data.project.revision}`);
    } catch (error) {
      toast(error.message || "No se pudo restaurar", "error");
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
  }

  function inlineFormat(raw) {
    let text = escapeHtml(raw);
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    return text;
  }

  function safeHttpUrl(raw) {
    try {
      const url = new URL(raw);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function isTableSeparator(line) {
    const cells = line.trim().replace(/^\||\|$/g, "").split("|");
    return cells.length > 1 && cells.every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell));
  }

  function renderTable(lines, start) {
    const header = lines[start].trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
    if (start + 1 >= lines.length || !isTableSeparator(lines[start + 1])) return null;

    const rows = [];
    let index = start + 2;
    while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
      rows.push(lines[index].trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
      index += 1;
    }

    const head = `<thead><tr>${header.map((cell) => `<th>${inlineFormat(cell)}</th>`).join("")}</tr></thead>`;
    const body = `<tbody>${rows.map((row) => `<tr>${header.map((_, cellIndex) => `<td>${inlineFormat(row[cellIndex] || "")}</td>`).join("")}</tr>`).join("")}</tbody>`;
    return { html: `<table>${head}${body}</table>`, next: index };
  }

  function renderStructured(raw) {
    const lines = String(raw || "").replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let index = 0;
    let paragraph = [];
    let listItems = [];
    let inCode = false;
    let codeLines = [];

    const flushParagraph = () => {
      if (!paragraph.length) return;
      out.push(`<p>${paragraph.map(inlineFormat).join("<br>")}</p>`);
      paragraph = [];
    };

    const flushList = () => {
      if (!listItems.length) return;
      out.push(`<ul>${listItems.map((item) => `<li>${inlineFormat(item)}</li>`).join("")}</ul>`);
      listItems = [];
    };

    while (index < lines.length) {
      const line = lines[index];

      if (line.trim().startsWith("```")) {
        flushParagraph();
        flushList();
        if (inCode) {
          out.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
          codeLines = [];
          inCode = false;
        } else {
          inCode = true;
        }
        index += 1;
        continue;
      }

      if (inCode) {
        codeLines.push(line);
        index += 1;
        continue;
      }

      const table = line.includes("|") ? renderTable(lines, index) : null;
      if (table) {
        flushParagraph();
        flushList();
        out.push(table.html);
        index = table.next;
        continue;
      }

      const imageMatch = line.trim().match(/^!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)$/i);
      if (imageMatch) {
        flushParagraph();
        flushList();
        const url = safeHttpUrl(imageMatch[2]);
        if (url) {
          out.push(`<figure><img src="${escapeAttr(url)}" alt="${escapeAttr(imageMatch[1])}" loading="lazy"><figcaption>${escapeHtml(imageMatch[1])}</figcaption></figure>`);
        }
        index += 1;
        continue;
      }

      const mathMatch = line.trim().match(/^\$\$(.+)\$\$$/);
      if (mathMatch) {
        flushParagraph();
        flushList();
        out.push(`<div class="math-block">${escapeHtml(mathMatch[1].trim())}</div>`);
        index += 1;
        continue;
      }

      if (/^---+$/.test(line.trim())) {
        flushParagraph();
        flushList();
        out.push("<hr>");
        index += 1;
        continue;
      }

      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        flushList();
        const level = heading[1].length;
        out.push(`<h${level}>${inlineFormat(heading[2])}</h${level}>`);
        index += 1;
        continue;
      }

      const list = line.match(/^\s*[-*]\s+(.+)$/);
      if (list) {
        flushParagraph();
        listItems.push(list[1]);
        index += 1;
        continue;
      }

      if (line.startsWith("> ")) {
        flushParagraph();
        flushList();
        out.push(`<blockquote>${inlineFormat(line.slice(2))}</blockquote>`);
        index += 1;
        continue;
      }

      if (!line.trim()) {
        flushParagraph();
        flushList();
        index += 1;
        continue;
      }

      paragraph.push(line);
      index += 1;
    }

    if (inCode) out.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    flushParagraph();
    flushList();
    return out.join("\n");
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return new Intl.DateTimeFormat("es-PY", { dateStyle: "medium" }).format(date);
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return new Intl.DateTimeFormat("es-PY", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  function buildDocumentMarkup(draft) {
    const members = draft.members.length ? draft.members.join(", ") : "—";
    const workType = draft.work_type === "individual" ? "Individual" : "Grupal";

    return `
      <div class="doc-kicker">${escapeHtml(draft.subject || "UCOM")}</div>
      <h1 class="doc-title">${escapeHtml(draft.title || "Trabajo académico")}</h1>

      <section class="doc-meta">
        <div><span>Materia</span><strong>${escapeHtml(draft.subject || "—")}</strong></div>
        <div><span>Profesor/a</span><strong>${escapeHtml(draft.professor || "—")}</strong></div>
        <div><span>Fecha</span><strong>${formatDate(draft.class_date)}</strong></div>
        <div><span>Modalidad</span><strong>${workType}</strong></div>
        <div><span>Integrantes</span><strong>${escapeHtml(members)}</strong></div>
        <div><span>Entrega</span><strong>${draft.due_date ? formatDateTime(draft.due_date) : "—"}</strong></div>
      </section>

      ${draft.directives ? `<section class="doc-directives"><strong>Consigna</strong><br>${escapeHtml(draft.directives).replaceAll("\n", "<br>")}</section>` : ""}

      <section class="doc-body">${renderStructured(draft.content)}</section>

      <footer class="doc-footer">Documento generado en UCOM Workspace · HTML</footer>
    `;
  }

  function renderPreview() {
    if (!els.preview || !state.project) return;
    const draft = gatherDraft();
    els.preview.className = `paper theme-${draft.template}`;
    els.preview.innerHTML = buildDocumentMarkup(draft);
  }

  function exportHtml() {
    if (!state.project) return;
    const draft = gatherDraft();
    const markup = buildDocumentMarkup(draft);
    const exportCss = `
      *{box-sizing:border-box}body{margin:0;background:#eef2f5;color:#17202b;font-family:Arial,sans-serif}
      .paper{width:210mm;min-height:297mm;margin:20px auto;background:#fff;padding:18mm 17mm 20mm;line-height:1.55}
      .doc-kicker{text-transform:uppercase;letter-spacing:.13em;font-size:9pt;font-weight:800;color:#607080}
      .doc-title{font-size:28pt;line-height:1.05;margin:4mm 0 7mm;color:#173a63}
      .doc-meta{display:grid;grid-template-columns:1fr 1fr;gap:4mm 8mm;padding:5mm 0;margin-bottom:8mm;border-top:1px solid #dce3e8;border-bottom:1px solid #dce3e8}
      .doc-meta span{display:block;font-size:8pt;text-transform:uppercase;letter-spacing:.08em;color:#788693}.doc-meta strong{display:block;margin-top:1mm;font-size:10pt}
      .doc-directives{padding:5mm;border-left:4px solid #24749e;background:#f4f7f9;margin-bottom:9mm;font-size:10pt}
      .doc-body h1,.doc-body h2,.doc-body h3{line-height:1.15;color:#173a63}.doc-body h1{font-size:21pt}.doc-body h2{font-size:16pt;border-bottom:2px solid #dcebf1;padding-bottom:2mm}.doc-body h3{font-size:13pt}
      .doc-body p{margin:0 0 4mm}.doc-body blockquote{border-left:4px solid #9baebb;background:#f5f7f8;padding:3mm 5mm;margin:5mm 0}.doc-body .math-block{margin:5mm 0;padding:3mm;text-align:center;font-family:Georgia,serif;font-style:italic;background:#f7f9fb;border-radius:6px}.doc-body code{background:#eef2f5;padding:1px 4px;border-radius:4px}.doc-body pre{background:#111a23;color:#eaf2f8;padding:4mm;overflow:auto;border-radius:8px}
      table{width:100%;border-collapse:collapse;margin:5mm 0}th,td{border:1px solid #d8e0e6;padding:2.5mm;text-align:left;vertical-align:top}th{background:#f0f4f7}img{max-width:100%;height:auto;display:block;margin:5mm auto}.doc-footer{margin-top:14mm;padding-top:3mm;border-top:1px solid #e3e8ec;color:#81909c;font-size:8pt}
      .theme-minimal .doc-title{font-family:Georgia,serif;color:#111}.theme-minimal .doc-directives{border:1px solid #ddd;background:none}
      .theme-visual{border-top:5mm solid #153b5f}.theme-visual .doc-meta{padding:5mm;background:#f0f7fa;border:0}.theme-visual .doc-directives{background:#123957;color:#fff;border:0}
      @media print{body{background:#fff}.paper{margin:0;box-shadow:none}}@page{size:A4;margin:0}
    `;

    const file = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(draft.title || "Trabajo UCOM")}</title>
<style>${exportCss}</style>
</head>
<body><article class="paper theme-${escapeAttr(draft.template)}">${markup}</article></body>
</html>`;

    const blob = new Blob([file], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(draft.title || "ucom-trabajo")}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("HTML exportado");
  }

  function slugify(value) {
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "ucom-trabajo";
  }

  async function copyText(value, success = "Copiado") {
    try {
      await navigator.clipboard.writeText(value);
      toast(success);
    } catch {
      const area = document.createElement("textarea");
      area.value = value;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      toast(success);
    }
  }

  function wireEvents() {
    els.newProjectBtn.addEventListener("click", () => els.createDialog.showModal());
    els.openSharedBtn.addEventListener("click", () => openSharedDialog());
    els.backBtn.addEventListener("click", () => {
      if (state.dirty && !confirm("Hay cambios sin guardar. ¿Salir igualmente?")) return;
      location.hash = "";
      showLanding();
    });

    els.createForm.addEventListener("submit", createProject);
    els.sharedForm.addEventListener("submit", sharedLogin);
    els.saveBtn.addEventListener("click", saveProject);
    els.exportBtn.addEventListener("click", exportHtml);

    els.shareBtn.addEventListener("click", async () => {
      els.newShareResult.classList.add("hidden");
      els.newShareResult.innerHTML = "";
      els.shareDialog.showModal();
      await loadShares();
    });

    els.shareForm.addEventListener("submit", createShare);
    els.generatePasswordBtn.addEventListener("click", () => {
      els.shareForm.elements.password.value = generatePassword();
    });

    els.historyBtn.addEventListener("click", loadHistory);
    els.restoreVersionBtn.addEventListener("click", restoreVersion);

    els.copyOwnerKeyBtn.addEventListener("click", () => copyText(els.ownerKeyText.textContent, "Clave copiada"));
    els.ownerKeyDoneBtn.addEventListener("click", () => els.ownerKeyDialog.close());

    $$(".dialog-close").forEach((button) => {
      button.addEventListener("click", () => button.closest("dialog")?.close());
    });

    els.recentProjects.addEventListener("click", (event) => {
      const button = event.target.closest(".recent-open");
      if (!button) return;
      location.hash = button.dataset.route;
    });

    els.shareList.addEventListener("click", (event) => {
      const button = event.target.closest(".revoke-share");
      if (button) revokeShare(button.dataset.id);
    });

    els.newShareResult.addEventListener("click", (event) => {
      const button = event.target.closest(".copy-share");
      if (!button) return;
      copyText(`${button.dataset.link}\nContraseña: ${button.dataset.password}`, "Enlace y contraseña copiados");
    });

    els.historyList.addEventListener("click", (event) => {
      const button = event.target.closest(".view-version");
      if (button) viewVersion(Number(button.dataset.revision));
    });

    const editableControls = [
      els.subject, els.title, els.professor, els.classDate, els.dueDate,
      els.workType, els.members, els.directives, els.content, els.template,
    ];

    editableControls.forEach((control) => {
      control.addEventListener("input", () => {
        if (!state.project || control.disabled) return;
        setDirty(true);
        renderPreview();
        if (control === els.title) els.workspaceTitle.textContent = control.value || "Proyecto";
      });
      control.addEventListener("change", () => {
        if (!state.project || control.disabled) return;
        setDirty(true);
        renderPreview();
      });
    });

    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        if (!els.workspace.classList.contains("hidden")) {
          event.preventDefault();
          saveProject();
        }
      }
    });

    window.addEventListener("beforeunload", (event) => {
      if (!state.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    });

    window.addEventListener("hashchange", routeFromLocation);
  }

  function ensureSharedOwnerField() {
    if (els.sharedForm.elements.owner_key) return;
    const ownerLabel = document.createElement("label");
    ownerLabel.innerHTML = `Clave de propietario <span class="muted">(opcional)</span><input name="owner_key" autocomplete="off" placeholder="Para abrir como propietario en otro navegador">`;
    const submit = els.sharedForm.querySelector('button[type="submit"]');
    els.sharedForm.insertBefore(ownerLabel, submit);
  }

  function boot() {
    ensureSharedOwnerField();
    wireEvents();
    renderRecents();
    routeFromLocation();
  }

  boot();
})();
