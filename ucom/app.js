(() => {
  "use strict";

  const API_BASE = "https://ucom-api.ufotech.com.py";
  const ADMIN_KEY = "ucom.admin.session.v2";
  const state = { project: null, token: "", role: "", access: null, dirty: false, selectedRevision: null };
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const els = {
    landing: $("#landing"), workspace: $("#workspace"), adminState: $("#adminState"),
    adminLoginBtn: $("#adminLoginBtn"), adminLogoutBtn: $("#adminLogoutBtn"), newProjectBtn: $("#newProjectBtn"), openTaskBtn: $("#openTaskBtn"), projectList: $("#projectList"),
    backBtn: $("#backBtn"), workspaceTitle: $("#workspaceTitle"), accessBadge: $("#accessBadge"), saveState: $("#saveState"), saveBtn: $("#saveBtn"), historyBtn: $("#historyBtn"), accessBtn: $("#accessBtn"), exportBtn: $("#exportBtn"),
    subject: $("#subjectInput"), title: $("#titleInput"), professor: $("#professorInput"), classDate: $("#classDateInput"), dueDate: $("#dueDateInput"), workType: $("#workTypeInput"), members: $("#membersInput"), directives: $("#directivesInput"), content: $("#contentInput"), template: $("#templateInput"), preview: $("#previewPaper"), toast: $("#toast"),
    adminDialog: $("#adminDialog"), adminForm: $("#adminForm"), adminHint: $("#adminHint"), createDialog: $("#createDialog"), createForm: $("#createForm"), memberDialog: $("#memberDialog"), memberForm: $("#memberForm"),
    accessDialog: $("#accessDialog"), accessInfo: $("#accessInfo"), accessSecret: $("#accessSecret"), accessPassword: $("#accessPassword"), accessLink: $("#accessLink"), copyPasswordBtn: $("#copyPasswordBtn"), copyLinkBtn: $("#copyLinkBtn"), rotateAccessForm: $("#rotateAccessForm"), revokeAccessBtn: $("#revokeAccessBtn"),
    historyDialog: $("#historyDialog"), historyList: $("#historyList"), versionDialog: $("#versionDialog"), versionTitle: $("#versionTitle"), versionContent: $("#versionContent"), restoreVersionBtn: $("#restoreVersionBtn"),
  };

  function toast(message, type = "info") {
    els.toast.textContent = message;
    els.toast.className = `toast show ${type === "error" ? "error" : ""}`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { els.toast.className = "toast"; }, 3500);
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers, cache: "no-store" });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text || `HTTP ${response.status}` }; }
    if (!response.ok) {
      const error = new Error(data.error || `HTTP ${response.status}`);
      error.status = response.status; error.data = data; throw error;
    }
    return data;
  }

  function adminToken() { return sessionStorage.getItem(ADMIN_KEY) || ""; }
  function participantKey(projectId) { return `ucom.participant.${projectId}`; }
  function authHeaders(token = state.token) { return token ? { Authorization: `Bearer ${token}` } : {}; }
  function splitMembers(text) { return text.split(/\r?\n/).map(v => v.trim()).filter(Boolean); }
  function normalizeDate(v) { return v ? String(v).slice(0, 10) : ""; }
  function normalizeDateTime(v) { return v && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(v)) ? String(v).slice(0, 16) : ""; }
  function parseRoute() { const m = location.hash.match(/^#\/p\/([^/]+)\/?$/); return m ? decodeURIComponent(m[1]) : ""; }

  function showLanding() {
    state.project = null; state.token = ""; state.role = ""; state.access = null; state.dirty = false;
    els.workspace.classList.add("hidden"); els.landing.classList.remove("hidden"); document.title = "UCOM Workspace";
  }
  function showWorkspace() { els.landing.classList.add("hidden"); els.workspace.classList.remove("hidden"); }
  function setDirty(v = true) { state.dirty = v; els.saveState.textContent = v ? "Sin guardar" : "Guardado"; els.saveState.className = `save-state ${v ? "dirty" : "saved"}`; }

  function setAdminUI(logged) {
    els.adminState.textContent = logged ? "Admin conectado" : "Admin desconectado";
    els.adminLogoutBtn.classList.toggle("hidden", !logged);
    els.newProjectBtn.classList.toggle("hidden", !logged);
  }

  async function refreshAdminState() {
    try {
      const status = await api("/api/admin/status");
      if (!status.configured) {
        els.adminState.textContent = "Admin sin configurar";
        els.adminHint.textContent = "Primero configurá la contraseña de administrador en el servidor.";
        setAdminUI(false);
        return;
      }
      if (adminToken()) {
        try { await loadAdminProjects(); setAdminUI(true); return; }
        catch (e) { if (e.status === 401) sessionStorage.removeItem(ADMIN_KEY); }
      }
      setAdminUI(false);
    } catch { els.adminState.textContent = "API no disponible"; }
  }

  async function loginAdmin(event) {
    event.preventDefault();
    const password = new FormData(els.adminForm).get("password") || "";
    try {
      const data = await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
      sessionStorage.setItem(ADMIN_KEY, data.token);
      els.adminForm.reset(); els.adminDialog.close(); setAdminUI(true); await loadAdminProjects(); toast("Administrador conectado");
    } catch (e) { toast(e.message, "error"); }
  }

  async function logoutAdmin() {
    const token = adminToken();
    if (token) { try { await api("/api/admin/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } }); } catch {} }
    sessionStorage.removeItem(ADMIN_KEY); setAdminUI(false); els.projectList.innerHTML = '<div class="empty-state">Iniciá sesión como administrador para ver y crear tareas.</div>'; showLanding();
  }

  async function loadAdminProjects() {
    const token = adminToken();
    if (!token) return;
    const data = await api("/api/admin/projects", { headers: { Authorization: `Bearer ${token}` } });
    const items = data.projects || [];
    if (!items.length) { els.projectList.innerHTML = '<div class="empty-state">Todavía no hay tareas.</div>'; return; }
    els.projectList.innerHTML = items.map(p => `
      <div class="recent-item">
        <div><strong>${escapeHtml(p.title || "Tarea")}</strong><small>${escapeHtml(p.subject || "Sin materia")} · rev. ${p.revision}${p.access ? ` · acceso hasta ${escapeHtml(formatDate(p.access.expires_at))}` : " · sin acceso"}</small></div>
        <button class="ghost project-open" data-id="${escapeAttr(p.id)}">Abrir</button>
      </div>`).join("");
  }

  async function createProject(event) {
    event.preventDefault();
    const token = adminToken();
    if (!token) { els.createDialog.close(); els.adminDialog.showModal(); return; }
    const f = new FormData(els.createForm);
    const payload = {
      subject: f.get("subject") || "", title: f.get("title") || "", professor: f.get("professor") || "",
      class_date: f.get("class_date") || "", due_date: f.get("due_date") || "", work_type: f.get("work_type") || "group",
      members: splitMembers(String(f.get("members") || "")), directives: "", content: "", template: "ucom", access_mode: f.get("access_mode") || "24h",
    };
    try {
      const data = await api("/api/projects", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      els.createDialog.close(); els.createForm.reset(); await loadAdminProjects();
      history.replaceState(null, "", `#/p/${encodeURIComponent(data.project.id)}`);
      await openProject(data.project.id, token, "admin");
      await showAccess(data.participant_access);
      toast("Tarea creada");
    } catch (e) { toast(e.message, "error"); }
  }

  async function participantLogin(event) {
    event.preventDefault();
    const f = new FormData(els.memberForm);
    const projectId = String(f.get("project_id") || "").trim();
    const name = String(f.get("name") || "").trim();
    const password = String(f.get("password") || "");
    try {
      const data = await api(`/api/projects/${encodeURIComponent(projectId)}/login`, { method: "POST", body: JSON.stringify({ name, password }) });
      sessionStorage.setItem(participantKey(projectId), data.token);
      els.memberForm.reset(); els.memberDialog.close(); history.replaceState(null, "", `#/p/${encodeURIComponent(projectId)}`);
      await openProject(projectId, data.token, "participant");
    } catch (e) { toast(e.message, "error"); }
  }

  async function openProject(projectId, token, roleHint = "") {
    try {
      const data = await api(`/api/projects/${encodeURIComponent(projectId)}`, { headers: { Authorization: `Bearer ${token}` } });
      state.token = token; state.role = data.access.role || roleHint; state.access = data.access; showWorkspace(); applyProject(data.project); applyAccess(data.access);
    } catch (e) {
      if (roleHint === "participant" && e.status === 401) sessionStorage.removeItem(participantKey(projectId));
      throw e;
    }
  }

  async function routeFromLocation() {
    const projectId = parseRoute();
    if (!projectId) { showLanding(); await refreshAdminState(); return; }
    const admin = adminToken();
    if (admin) { try { await openProject(projectId, admin, "admin"); return; } catch (e) { if (e.status === 401) sessionStorage.removeItem(ADMIN_KEY); } }
    const participant = sessionStorage.getItem(participantKey(projectId)) || "";
    if (participant) { try { await openProject(projectId, participant, "participant"); return; } catch {} }
    showLanding(); els.memberForm.elements.project_id.value = projectId; els.memberDialog.showModal();
  }

  function applyProject(project) {
    state.project = project;
    els.subject.value = project.subject || ""; els.title.value = project.title || ""; els.professor.value = project.professor || "";
    els.classDate.value = normalizeDate(project.class_date); els.dueDate.value = normalizeDateTime(project.due_date); els.workType.value = project.work_type || "group";
    els.members.value = (project.members || []).join("\n"); els.directives.value = project.directives || ""; els.content.value = project.content || ""; els.template.value = project.template || "ucom";
    els.workspaceTitle.textContent = project.title || "Tarea"; document.title = `${project.title || "Tarea"} · UCOM Workspace`; setDirty(false); renderPreview();
  }

  function applyAccess(access) {
    const admin = access?.role === "admin";
    els.accessBadge.textContent = admin ? "Administrador" : `${access?.actor_name || "Integrante"} · edición`;
    $$(".admin-only").forEach(n => n.classList.toggle("hidden", !admin));
    [els.subject, els.title, els.professor, els.classDate, els.dueDate, els.workType, els.members, els.directives].forEach(c => c.disabled = !admin);
    els.content.disabled = false; els.template.disabled = false; els.saveBtn.classList.remove("hidden");
  }

  function gatherDraft() {
    const core = { content: els.content.value, template: els.template.value };
    if (state.role !== "admin") return core;
    return { ...core, subject: els.subject.value, title: els.title.value, professor: els.professor.value, class_date: els.classDate.value, due_date: els.dueDate.value, work_type: els.workType.value, members: splitMembers(els.members.value), directives: els.directives.value };
  }

  async function saveProject() {
    if (!state.project || !state.token || !state.dirty) return;
    els.saveBtn.disabled = true; els.saveState.textContent = "Guardando…"; els.saveState.className = "save-state saving";
    try {
      const data = await api(`/api/projects/${encodeURIComponent(state.project.id)}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify({ ...gatherDraft(), expected_revision: state.project.revision }) });
      applyProject(data.project); applyAccess(data.access); if (state.role === "admin") loadAdminProjects().catch(() => {});
    } catch (e) {
      if (e.status === 409 && e.data?.project) { applyProject(e.data.project); toast("Había cambios de otra persona. Recargué la última versión.", "error"); }
      else toast(e.message, "error");
    } finally { els.saveBtn.disabled = false; }
  }

  async function showAccess(fresh = null) {
    if (!state.project || state.role !== "admin") return;
    let access = fresh;
    if (!access) {
      const data = await api(`/api/projects/${encodeURIComponent(state.project.id)}/access`, { headers: authHeaders() });
      access = data.access;
    }
    els.accessSecret.classList.toggle("hidden", !fresh?.password);
    if (fresh?.password) {
      els.accessPassword.textContent = fresh.password;
      els.accessLink.textContent = `${location.origin}${location.pathname}#/p/${encodeURIComponent(state.project.id)}`;
    }
    els.accessInfo.textContent = access ? `Acceso vigente hasta ${formatDate(access.expires_at)}. La contraseña actual no puede recuperarse; para cambiarla, generá una nueva.` : "No hay acceso vigente para integrantes.";
    els.accessDialog.showModal();
  }

  async function rotateAccess(event) {
    event.preventDefault();
    const mode = new FormData(els.rotateAccessForm).get("access_mode") || "24h";
    try {
      const data = await api(`/api/projects/${encodeURIComponent(state.project.id)}/access/rotate`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ access_mode: mode }) });
      await showAccess(data.participant_access); toast("Nueva contraseña generada");
    } catch (e) { toast(e.message, "error"); }
  }

  async function revokeAccess() {
    if (!confirm("¿Revocar el acceso de todos los integrantes a esta tarea?")) return;
    try { await api(`/api/projects/${encodeURIComponent(state.project.id)}/access`, { method: "DELETE", headers: authHeaders() }); els.accessDialog.close(); toast("Acceso revocado"); await loadAdminProjects(); }
    catch (e) { toast(e.message, "error"); }
  }

  async function showHistory() {
    try {
      const data = await api(`/api/projects/${encodeURIComponent(state.project.id)}/versions`, { headers: authHeaders() });
      els.historyList.innerHTML = (data.versions || []).map(v => `<div class="recent-item"><div><strong>Revisión ${v.revision}</strong><small>${escapeHtml(v.actor_name)} · ${escapeHtml(formatDate(v.created_at))}</small></div><button class="ghost version-open" data-revision="${v.revision}">Ver</button></div>`).join("") || '<div class="empty-state">Sin versiones.</div>';
      els.historyDialog.showModal();
    } catch (e) { toast(e.message, "error"); }
  }

  async function openVersion(revision) {
    try {
      const data = await api(`/api/projects/${encodeURIComponent(state.project.id)}/versions/${revision}`, { headers: authHeaders() });
      state.selectedRevision = revision; els.versionTitle.textContent = `Revisión ${revision}`; els.versionContent.textContent = JSON.stringify(data.version.snapshot, null, 2);
      els.restoreVersionBtn.classList.toggle("hidden", state.role !== "admin"); els.versionDialog.showModal();
    } catch (e) { toast(e.message, "error"); }
  }

  async function restoreVersion() {
    if (state.role !== "admin" || !state.selectedRevision) return;
    try {
      const data = await api(`/api/projects/${encodeURIComponent(state.project.id)}/versions/${state.selectedRevision}/restore`, { method: "POST", headers: authHeaders() });
      applyProject(data.project); applyAccess({ role: "admin", permission: "edit", actor_name: "Administrador" }); els.versionDialog.close(); els.historyDialog.close(); toast("Versión restaurada");
    } catch (e) { toast(e.message, "error"); }
  }

  function escapeHtml(v = "") { return String(v).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]); }
  function escapeAttr(v = "") { return escapeHtml(v); }
  function inline(text) {
    let out = escapeHtml(text);
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    return out;
  }

  function renderBody(text) {
    const lines = String(text || "").replace(/\r/g, "").split("\n");
    const out = []; let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      if (line.trim().startsWith("$$")) {
        const buf = [line.trim().replace(/^\$\$/, "")]; i++;
        while (i < lines.length && !lines[i].trim().endsWith("$$")) { buf.push(lines[i]); i++; }
        if (i < lines.length) { buf.push(lines[i].trim().replace(/\$\$$/, "")); i++; }
        out.push(`<div class="math-block">${escapeHtml(buf.join("\n"))}</div>`); continue;
      }
      const hm = line.match(/^(#{1,3})\s+(.+)$/); if (hm) { out.push(`<h${hm[1].length}>${inline(hm[2])}</h${hm[1].length}>`); i++; continue; }
      if (/^>\s?/.test(line)) { out.push(`<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`); i++; continue; }
      if (/^-\s+/.test(line)) { const items=[]; while(i<lines.length && /^-\s+/.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^-\s+/, ""))}</li>`); i++; } out.push(`<ul>${items.join("")}</ul>`); continue; }
      if (/^\|.*\|$/.test(line.trim()) && i + 1 < lines.length && /^\|?[\s:-]+(?:\|[\s:-]+)+\|?$/.test(lines[i+1].trim())) {
        const cells = s => s.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
        const head = cells(line); i += 2; const rows=[]; while(i<lines.length && /^\|.*\|$/.test(lines[i].trim())) { rows.push(cells(lines[i])); i++; }
        out.push(`<table><thead><tr>${head.map(c=>`<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`); continue;
      }
      const para=[line]; i++; while(i<lines.length && lines[i].trim() && !/^(#{1,3})\s+|^-\s+|^>\s?|^\|.*\|$|^\$\$/.test(lines[i])) { para.push(lines[i]); i++; }
      out.push(`<p>${inline(para.join(" "))}</p>`);
    }
    return out.join("");
  }

  function renderPreview() {
    const p = state.project || {};
    const theme = els.template.value || "ucom";
    els.preview.className = `paper theme-${theme}`;
    const members = splitMembers(els.members.value);
    els.preview.innerHTML = `
      <div class="doc-kicker">${escapeHtml(els.subject.value || "UCOM")}</div>
      <h1 class="doc-title">${escapeHtml(els.title.value || "Sin título")}</h1>
      <div class="doc-meta">
        <div><span>Profesor/a</span><strong>${escapeHtml(els.professor.value || "—")}</strong></div>
        <div><span>Fecha</span><strong>${escapeHtml(els.classDate.value || "—")}</strong></div>
        <div><span>Entrega</span><strong>${escapeHtml(els.dueDate.value || "—")}</strong></div>
        <div><span>Integrantes</span><strong>${escapeHtml(members.join(", ") || "—")}</strong></div>
      </div>
      ${els.directives.value ? `<div class="doc-directives">${escapeHtml(els.directives.value)}</div>` : ""}
      <div class="doc-body">${renderBody(els.content.value)}</div>
      <div class="doc-footer">UCOM Workspace · revisión ${p.revision || 1}</div>`;
  }

  function exportHtml() {
    if (!state.project) return;
    const title = els.title.value || "Tarea";
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;margin:0;background:#eef2f5;color:#17202b}.paper{width:min(794px,calc(100% - 32px));min-height:1123px;margin:24px auto;background:#fff;padding:64px;box-sizing:border-box}.doc-kicker{text-transform:uppercase;letter-spacing:.12em;font-size:11px;color:#667}.doc-title{font-size:34px}.doc-meta{display:grid;grid-template-columns:1fr 1fr;gap:12px 24px;padding:18px 0;border-top:1px solid #ddd;border-bottom:1px solid #ddd}.doc-meta span{display:block;font-size:10px;text-transform:uppercase;color:#778}.doc-directives{white-space:pre-wrap;background:#f4f7f9;padding:16px;margin:24px 0}.doc-body{line-height:1.6}.doc-body table{width:100%;border-collapse:collapse}.doc-body th,.doc-body td{border:1px solid #ddd;padding:8px}.math-block{text-align:center;font-family:serif;font-style:italic;background:#f7f9fb;padding:12px}.doc-footer{margin-top:48px;border-top:1px solid #ddd;padding-top:12px;color:#889;font-size:11px}</style></head><body>${els.preview.outerHTML}</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${title.replace(/[^a-z0-9áéíóúñ_-]+/gi, "-")}.html`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  }

  function formatDate(value) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("es-PY", { dateStyle: "medium", timeStyle: "short" }); }
  async function copyText(text) { try { await navigator.clipboard.writeText(text); toast("Copiado"); } catch { toast("No se pudo copiar", "error"); } }

  els.adminLoginBtn.addEventListener("click", () => els.adminDialog.showModal());
  els.adminLogoutBtn.addEventListener("click", logoutAdmin);
  els.newProjectBtn.addEventListener("click", () => adminToken() ? els.createDialog.showModal() : els.adminDialog.showModal());
  els.openTaskBtn.addEventListener("click", () => els.memberDialog.showModal());
  els.adminForm.addEventListener("submit", loginAdmin); els.createForm.addEventListener("submit", createProject); els.memberForm.addEventListener("submit", participantLogin);
  els.backBtn.addEventListener("click", () => { history.replaceState(null, "", location.pathname); showLanding(); refreshAdminState(); });
  els.saveBtn.addEventListener("click", saveProject); els.historyBtn.addEventListener("click", showHistory); els.accessBtn.addEventListener("click", () => showAccess()); els.exportBtn.addEventListener("click", exportHtml);
  els.rotateAccessForm.addEventListener("submit", rotateAccess); els.revokeAccessBtn.addEventListener("click", revokeAccess); els.restoreVersionBtn.addEventListener("click", restoreVersion);
  els.copyPasswordBtn.addEventListener("click", () => copyText(els.accessPassword.textContent)); els.copyLinkBtn.addEventListener("click", () => copyText(els.accessLink.textContent));
  $$(".dialog-close").forEach(btn => btn.addEventListener("click", () => btn.closest("dialog")?.close()));
  els.projectList.addEventListener("click", e => { const b = e.target.closest(".project-open"); if (!b) return; history.replaceState(null, "", `#/p/${encodeURIComponent(b.dataset.id)}`); routeFromLocation(); });
  els.historyList.addEventListener("click", e => { const b = e.target.closest(".version-open"); if (b) openVersion(Number(b.dataset.revision)); });
  [els.subject, els.title, els.professor, els.classDate, els.dueDate, els.workType, els.members, els.directives, els.content, els.template].forEach(c => c.addEventListener("input", () => { setDirty(true); renderPreview(); }));
  window.addEventListener("hashchange", routeFromLocation);
  window.addEventListener("beforeunload", e => { if (state.dirty) { e.preventDefault(); e.returnValue = ""; } });

  routeFromLocation();
})();
