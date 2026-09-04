(() => {
  "use strict";

  const API = "https://ucom-api.ufotech.com.py";
  const ADMIN_KEY = "ucom.admin.session.v2";
  const nativeFetch = window.fetch.bind(window);
  const settingsCache = new Map();
  let lastAccess = null;
  let workspaceMembers = [];
  let createMembers = [];
  let lastHiddenMembers = null;
  let lastProjectId = "";
  let lastChatId = 0;

  const $ = (s) => document.querySelector(s);
  const projectId = () => {
    const m = location.hash.match(/^#\/p\/([^/]+)\/?$/);
    return m ? decodeURIComponent(m[1]) : "";
  };
  const token = (id = projectId()) => sessionStorage.getItem(ADMIN_KEY) || sessionStorage.getItem(`ucom.participant.${id}`) || "";
  const auth = (id = projectId()) => ({ Authorization: `Bearer ${token(id)}` });
  const asJson = async (response) => {
    const text = await response.text();
    try { return text ? JSON.parse(text) : {}; } catch { return {}; }
  };
  const jsonResponse = (data, response) => new Response(JSON.stringify(data), {
    status: response.status,
    statusText: response.statusText,
    headers: { "Content-Type": "application/json" },
  });
  const normalizeDT = (v) => v && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(v)) ? String(v).slice(0, 16) : "";
  const future = (v) => !v || new Date(v).getTime() > Date.now();

  window.fetch = async (input, init = {}) => {
    const rawUrl = typeof input === "string" ? input : input.url;
    const url = new URL(rawUrl, location.href);
    if (url.origin !== new URL(API).origin) return nativeFetch(input, init);
    const method = String(init.method || (typeof input !== "string" && input.method) || "GET").toUpperCase();
    const path = url.pathname;

    if (method === "POST" && path === "/api/projects") {
      let payload = {};
      try { payload = JSON.parse(init.body || "{}"); } catch {}
      const end = $("#createForm [name=project_end_at]")?.value || "";
      const mode = $("#createAccessMode")?.value || "project_end";
      const custom = $("#createForm [name=access_expires_at]")?.value || "";
      if (end && !future(end)) return new Response(JSON.stringify({ error: "el fin del proyecto debe ser futuro" }), { status: 400, headers: { "Content-Type": "application/json" } });
      if (mode === "custom" && (!custom || !future(custom))) return new Response(JSON.stringify({ error: "vencimiento inválido" }), { status: 400, headers: { "Content-Type": "application/json" } });
      const corePayload = { ...payload, access_mode: "24h" };
      const response = await nativeFetch(input, { ...init, body: JSON.stringify(corePayload) });
      if (!response.ok) return response;
      const data = await asJson(response.clone());
      const id = data.project?.id;
      if (!id) return response;
      try {
        const headers = new Headers(init.headers || {});
        headers.set("Content-Type", "application/json");
        await must(nativeFetch(`${API}/api/projects/${encodeURIComponent(id)}/settings`, {
          method: "PUT", headers, body: JSON.stringify({ project_end_at: end }), cache: "no-store",
        }));
        const rotated = await must(nativeFetch(`${API}/api/projects/${encodeURIComponent(id)}/access-v3/rotate`, {
          method: "POST", headers, body: JSON.stringify({ access_mode: mode, access_expires_at: custom }), cache: "no-store",
        }));
        const rdata = await asJson(rotated);
        settingsCache.set(id, end);
        data.project.project_end_at = end;
        data.participant_access = rdata.participant_access;
        lastAccess = rdata.participant_access;
        return jsonResponse(data, response);
      } catch (error) {
        const headers = new Headers(init.headers || {});
        nativeFetch(`${API}/api/projects/${encodeURIComponent(id)}`, { method: "DELETE", headers }).catch(() => {});
        return new Response(JSON.stringify({ error: error.message || "no se pudo crear la tarea" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
    }

    const projectMatch = path.match(/^\/api\/projects\/([^/]+)$/);
    if (projectMatch && method === "GET") {
      const response = await nativeFetch(input, init);
      if (!response.ok) return response;
      const data = await asJson(response.clone());
      const id = decodeURIComponent(projectMatch[1]);
      try {
        const settingRes = await nativeFetch(`${API}/api/projects/${encodeURIComponent(id)}/settings`, { headers: init.headers, cache: "no-store" });
        if (settingRes.ok) {
          const setting = await asJson(settingRes);
          settingsCache.set(id, setting.project_end_at || "");
          if (data.project) data.project.project_end_at = setting.project_end_at || "";
          setTimeout(() => { const el = $("#projectEndInput"); if (el && projectId() === id) el.value = normalizeDT(setting.project_end_at); }, 0);
        }
      } catch {}
      return jsonResponse(data, response);
    }

    if (projectMatch && method === "PUT") {
      const response = await nativeFetch(input, init);
      if (!response.ok) return response;
      const data = await asJson(response.clone());
      const id = decodeURIComponent(projectMatch[1]);
      const end = $("#projectEndInput")?.value || "";
      const sentToken = new Headers(init.headers || {}).get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
      if (sentToken && sentToken === sessionStorage.getItem(ADMIN_KEY)) {
        try {
          const settingRes = await nativeFetch(`${API}/api/projects/${encodeURIComponent(id)}/settings`, {
            method: "PUT", headers: { ...auth(id), "Content-Type": "application/json" }, body: JSON.stringify({ project_end_at: end }), cache: "no-store",
          });
          if (!settingRes.ok) return settingRes;
          settingsCache.set(id, end);
          if (data.project) data.project.project_end_at = end;
        } catch {}
      }
      return jsonResponse(data, response);
    }

    const accessMatch = path.match(/^\/api\/projects\/([^/]+)\/access$/);
    if (accessMatch && method === "GET") {
      const id = decodeURIComponent(accessMatch[1]);
      const response = await nativeFetch(`${API}/api/projects/${encodeURIComponent(id)}/access-v3`, init);
      if (response.ok) { try { lastAccess = (await asJson(response.clone())).access; } catch {} }
      return response;
    }

    const rotateMatch = path.match(/^\/api\/projects\/([^/]+)\/access\/rotate$/);
    if (rotateMatch && method === "POST") {
      const id = decodeURIComponent(rotateMatch[1]);
      let payload = {};
      try { payload = JSON.parse(init.body || "{}"); } catch {}
      payload.access_mode = $("#rotateAccessMode")?.value || payload.access_mode || "project_end";
      payload.access_expires_at = $("#rotateAccessForm [name=access_expires_at]")?.value || "";
      const response = await nativeFetch(`${API}/api/projects/${encodeURIComponent(id)}/access-v3/rotate`, { ...init, body: JSON.stringify(payload) });
      if (response.ok) { try { lastAccess = (await asJson(response.clone())).participant_access; } catch {} }
      return response;
    }

    return nativeFetch(input, init);
  };

  async function must(response) {
    if (response.ok) return response;
    const data = await asJson(response);
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  function namesFrom(text) { return String(text || "").split(/\r?\n/).map(v => v.trim()).filter(Boolean); }
  function unique(list) { const seen = new Set(); return list.filter(name => { const k = name.toLocaleLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }); }

  function memberChip(name, remove) {
    const chip = document.createElement("span");
    chip.className = "member-chip";
    const label = document.createElement("span"); label.textContent = name; chip.append(label);
    if (remove) {
      const btn = document.createElement("button"); btn.type = "button"; btn.textContent = "×"; btn.setAttribute("aria-label", `Quitar ${name}`); btn.addEventListener("click", remove); chip.append(btn);
    }
    return chip;
  }

  function isAdminWorkspace() { return $("#accessBadge")?.textContent.trim() === "Administrador"; }

  function renderWorkspaceMembers() {
    const box = $("#membersList"); if (!box) return;
    const admin = isAdminWorkspace();
    box.replaceChildren(...workspaceMembers.map((name, index) => memberChip(name, admin ? () => {
      workspaceMembers.splice(index, 1); syncWorkspaceHidden(); renderWorkspaceMembers();
    } : null)));
    const single = $("#workTypeInput")?.value === "individual";
    const add = $("#addMemberBtn"); const input = $("#memberInput");
    if (add) add.disabled = !admin || (single && workspaceMembers.length >= 1);
    if (input) input.disabled = !admin || (single && workspaceMembers.length >= 1);
    const label = $("#memberEditorLabel"); if (label) label.textContent = single ? "Integrante" : "Integrantes";
  }

  function syncWorkspaceHidden() {
    workspaceMembers = unique(workspaceMembers);
    const hidden = $("#membersInput"); if (!hidden) return;
    hidden.value = workspaceMembers.join("\n");
    lastHiddenMembers = hidden.value;
    hidden.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function addWorkspaceMember() {
    const input = $("#memberInput"); if (!input) return;
    const name = input.value.trim(); if (!name) return;
    if ($("#workTypeInput")?.value === "individual" && workspaceMembers.length) return;
    workspaceMembers.push(name); input.value = ""; syncWorkspaceHidden(); renderWorkspaceMembers();
  }

  function renderCreateMembers() {
    const box = $("#createMembersList"); if (!box) return;
    box.replaceChildren(...createMembers.map((name, index) => memberChip(name, () => {
      createMembers.splice(index, 1); syncCreateHidden(); renderCreateMembers();
    })));
    const single = $("#createWorkType")?.value === "individual";
    const add = $("#addCreateMemberBtn"); const input = $("#createMemberInput");
    if (add) add.disabled = single && createMembers.length >= 1;
    if (input) input.disabled = single && createMembers.length >= 1;
    const label = $("#createMemberLabel"); if (label) label.textContent = single ? "Integrante" : "Integrantes";
  }

  function syncCreateHidden() {
    createMembers = unique(createMembers);
    const hidden = $("#createMembersHidden"); if (hidden) hidden.value = createMembers.join("\n");
  }

  function addCreateMember() {
    const input = $("#createMemberInput"); if (!input) return;
    const name = input.value.trim(); if (!name) return;
    if ($("#createWorkType")?.value === "individual" && createMembers.length) return;
    createMembers.push(name); input.value = ""; syncCreateHidden(); renderCreateMembers();
  }

  function enforceSingle(kind) {
    if (kind === "workspace") {
      if ($("#workTypeInput")?.value === "individual" && workspaceMembers.length > 1) workspaceMembers = workspaceMembers.slice(0, 1);
      syncWorkspaceHidden(); renderWorkspaceMembers();
    } else {
      if ($("#createWorkType")?.value === "individual" && createMembers.length > 1) createMembers = createMembers.slice(0, 1);
      syncCreateHidden(); renderCreateMembers();
    }
  }

  function toggleCustom(selectId, wrapId) {
    const select = $(selectId), wrap = $(wrapId); if (!select || !wrap) return;
    wrap.classList.toggle("hidden", select.value !== "custom");
  }

  function markDirty() {
    const known = $("#directivesInput");
    if (known) known.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value); if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat("es-PY", { dateStyle: "short", timeStyle: "short" }).format(d);
  }

  function cleanAccessCopy() {
    const el = $("#accessInfo"); if (!el) return;
    const text = lastAccess?.expires_at ? `Vence: ${formatDate(lastAccess.expires_at)}` : "Sin acceso vigente";
    if (el.textContent !== text && $("#accessDialog")?.open) el.textContent = text;
  }

  async function loadChat(reset = false) {
    const id = projectId(); if (!id || $("#workspace")?.classList.contains("hidden")) return;
    const t = token(id); if (!t) return;
    if (reset || id !== lastProjectId) { lastProjectId = id; lastChatId = 0; $("#chatMessages")?.replaceChildren(); }
    try {
      const response = await nativeFetch(`${API}/api/projects/${encodeURIComponent(id)}/chat?after=${lastChatId}`, { headers: auth(id), cache: "no-store" });
      if (!response.ok) return;
      const data = await asJson(response);
      appendMessages(data.messages || []);
    } catch {}
  }

  function appendMessages(messages) {
    const box = $("#chatMessages"); if (!box || !messages.length) return;
    const self = isAdminWorkspace() ? "Administrador" : ($("#accessBadge")?.textContent.split("·")[0].trim() || "");
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 90;
    for (const message of messages) {
      if (message.id <= lastChatId) continue;
      lastChatId = Math.max(lastChatId, message.id);
      const item = document.createElement("div"); item.className = `chat-message${message.actor_name === self ? " mine" : ""}`;
      const meta = document.createElement("div"); meta.className = "chat-meta";
      const who = document.createElement("strong"); who.textContent = message.actor_name;
      const when = document.createElement("span"); when.textContent = formatDate(message.created_at);
      meta.append(who, when);
      const body = document.createElement("div"); body.className = "chat-body"; body.textContent = message.body;
      item.append(meta, body); box.append(item);
    }
    if (nearBottom) box.scrollTop = box.scrollHeight;
  }

  async function sendChat(event) {
    event.preventDefault();
    const id = projectId(), input = $("#chatInput"), body = input?.value.trim();
    if (!id || !body) return;
    try {
      const response = await nativeFetch(`${API}/api/projects/${encodeURIComponent(id)}/chat`, {
        method: "POST", headers: { ...auth(id), "Content-Type": "application/json" }, body: JSON.stringify({ body }), cache: "no-store",
      });
      if (!response.ok) return;
      input.value = ""; await loadChat();
    } catch {}
  }

  function init() {
    $("#addMemberBtn")?.addEventListener("click", addWorkspaceMember);
    $("#memberInput")?.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addWorkspaceMember(); } });
    $("#addCreateMemberBtn")?.addEventListener("click", addCreateMember);
    $("#createMemberInput")?.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addCreateMember(); } });
    $("#workTypeInput")?.addEventListener("change", () => enforceSingle("workspace"));
    $("#createWorkType")?.addEventListener("change", () => enforceSingle("create"));
    $("#projectEndInput")?.addEventListener("input", markDirty);
    $("#createAccessMode")?.addEventListener("change", () => toggleCustom("#createAccessMode", "#createAccessCustomWrap"));
    $("#rotateAccessMode")?.addEventListener("change", () => toggleCustom("#rotateAccessMode", "#rotateAccessCustomWrap"));
    $("#chatForm")?.addEventListener("submit", sendChat);
    $("#refreshChatBtn")?.addEventListener("click", () => loadChat(false));
    toggleCustom("#createAccessMode", "#createAccessCustomWrap");
    toggleCustom("#rotateAccessMode", "#rotateAccessCustomWrap");
    renderCreateMembers(); renderWorkspaceMembers();

    setInterval(() => {
      const hidden = $("#membersInput");
      if (hidden && hidden.value !== lastHiddenMembers) {
        lastHiddenMembers = hidden.value; workspaceMembers = namesFrom(hidden.value); renderWorkspaceMembers();
      }
      const id = projectId();
      if (id && settingsCache.has(id) && $("#projectEndInput") && document.activeElement !== $("#projectEndInput")) {
        const expected = normalizeDT(settingsCache.get(id));
        if ($("#projectEndInput").value !== expected && !$("#saveState")?.classList.contains("dirty")) $("#projectEndInput").value = expected;
      }
      cleanAccessCopy();
    }, 450);
    setInterval(() => loadChat(false), 3000);
    window.addEventListener("hashchange", () => { lastProjectId = ""; lastChatId = 0; setTimeout(() => loadChat(true), 600); });
    setTimeout(() => loadChat(true), 800);
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
