(() => {
  "use strict";

  const API = "https://ucom-api.ufotech.com.py";
  const ADMIN_KEY = "ucom.admin.session.v2";
  const nativeFetch = window.fetch.bind(window);
  const settingsCache = new Map();
  let lastAccess = null;
  let workspaceMembers = [];
  let workspaceMax = 6;
  let lastHiddenMembers = null;
  let lastProjectId = "";
  let lastChatId = 0;
  let qrShareId = "";
  let qrObjectUrl = "";

  const $ = (s) => document.querySelector(s);
  const projectId = () => {
    const m = location.hash.match(/^#\/p\/([^/]+)\/?$/);
    return m ? decodeURIComponent(m[1]) : "";
  };
  const joinRoute = () => {
    const m = location.hash.match(/^#\/join\/([^/]+)\/([^/]+)\/?$/);
    return m ? { id: decodeURIComponent(m[1]), token: decodeURIComponent(m[2]) } : null;
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
  const clampMax = (value) => Math.max(1, Math.min(30, Number(value) || 1));

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
      const single = $("#createWorkType")?.value === "individual";
      const maximum = single ? 1 : clampMax($("#createMaxMembers")?.value || 6);
      if (end && !future(end)) return jsonError("el fin del proyecto debe ser futuro", 400);
      if (mode === "custom" && (!custom || !future(custom))) return jsonError("vencimiento inválido", 400);
      const corePayload = { ...payload, members: [], access_mode: "24h" };
      const response = await nativeFetch(input, { ...init, body: JSON.stringify(corePayload) });
      if (!response.ok) return response;
      const data = await asJson(response.clone());
      const id = data.project?.id;
      if (!id) return response;
      try {
        const headers = new Headers(init.headers || {});
        headers.set("Content-Type", "application/json");
        await must(nativeFetch(`${API}/api/projects/${encodeURIComponent(id)}/settings`, {
          method: "PUT", headers, body: JSON.stringify({ project_end_at: end, max_members: maximum }), cache: "no-store",
        }));
        const rotated = await must(nativeFetch(`${API}/api/projects/${encodeURIComponent(id)}/access-v3/rotate`, {
          method: "POST", headers, body: JSON.stringify({ access_mode: mode, access_expires_at: custom }), cache: "no-store",
        }));
        const rdata = await asJson(rotated);
        settingsCache.set(id, { project_end_at: end, max_members: maximum, members: [] });
        data.project.project_end_at = end;
        data.project.max_members = maximum;
        data.participant_access = rdata.participant_access;
        lastAccess = rdata.participant_access;
        return jsonResponse(data, response);
      } catch (error) {
        const headers = new Headers(init.headers || {});
        nativeFetch(`${API}/api/projects/${encodeURIComponent(id)}`, { method: "DELETE", headers }).catch(() => {});
        return jsonError(error.message || "no se pudo crear la tarea", 400);
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
          settingsCache.set(id, setting);
          if (data.project) {
            data.project.project_end_at = setting.project_end_at || "";
            data.project.max_members = setting.max_members || 1;
          }
          setTimeout(() => applySettingsToUI(id, setting), 0);
        }
      } catch {}
      return jsonResponse(data, response);
    }

    if (projectMatch && method === "PUT") {
      const response = await nativeFetch(input, init);
      if (!response.ok) return response;
      const data = await asJson(response.clone());
      const id = decodeURIComponent(projectMatch[1]);
      const sentToken = new Headers(init.headers || {}).get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
      if (sentToken && sentToken === sessionStorage.getItem(ADMIN_KEY)) {
        const end = $("#projectEndInput")?.value || "";
        const single = $("#workTypeInput")?.value === "individual";
        const maximum = single ? 1 : clampMax($("#maxMembersInput")?.value || workspaceMax);
        try {
          const settingRes = await nativeFetch(`${API}/api/projects/${encodeURIComponent(id)}/settings`, {
            method: "PUT",
            headers: { ...auth(id), "Content-Type": "application/json" },
            body: JSON.stringify({ project_end_at: end, max_members: maximum }),
            cache: "no-store",
          });
          if (!settingRes.ok) return settingRes;
          const setting = await asJson(settingRes.clone());
          settingsCache.set(id, { ...setting, members: data.project?.members || [] });
          if (data.project) {
            data.project.project_end_at = end;
            data.project.max_members = maximum;
          }
        } catch {}
      }
      return jsonResponse(data, response);
    }

    const loginMatch = path.match(/^\/api\/projects\/([^/]+)\/login$/);
    if (loginMatch && method === "POST") {
      const id = decodeURIComponent(loginMatch[1]);
      let payload = {};
      try { payload = JSON.parse(init.body || "{}"); } catch {}
      return nativeFetch(`${API}/api/projects/${encodeURIComponent(id)}/join-v3`, {
        ...init,
        body: JSON.stringify({ name: payload.name || "", password: payload.password || "" }),
      });
    }

    const accessMatch = path.match(/^\/api\/projects\/([^/]+)\/access$/);
    if (accessMatch && method === "GET") {
      const id = decodeURIComponent(accessMatch[1]);
      const response = await nativeFetch(`${API}/api/projects/${encodeURIComponent(id)}/access-v3`, init);
      if (response.ok) {
        const data = await asJson(response.clone());
        lastAccess = data.access;
      }
      return response;
    }
    if (accessMatch && method === "DELETE") {
      const response = await nativeFetch(input, init);
      if (response.ok) { lastAccess = null; clearQr(); }
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
      if (response.ok) {
        const data = await asJson(response.clone());
        lastAccess = data.participant_access;
        clearQr();
      }
      return response;
    }

    return nativeFetch(input, init);
  };

  function jsonError(message, status) {
    return new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json" } });
  }
  async function must(response) {
    if (response.ok) return response;
    const data = await asJson(response);
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  function namesFrom(text) { return String(text || "").split(/\r?\n/).map(v => v.trim()).filter(Boolean); }
  function unique(list) {
    const seen = new Set();
    return list.filter(name => {
      const k = name.toLocaleLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  function isAdminWorkspace() { return $("#accessBadge")?.textContent.trim() === "Administrador"; }

  function memberChip(name, remove) {
    const chip = document.createElement("span");
    chip.className = "member-chip";
    const label = document.createElement("span"); label.textContent = name; chip.append(label);
    if (remove) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "×";
      btn.setAttribute("aria-label", `Quitar ${name}`);
      btn.addEventListener("click", remove);
      chip.append(btn);
    }
    return chip;
  }

  function renderWorkspaceMembers() {
    const box = $("#membersList"); if (!box) return;
    const admin = isAdminWorkspace();
    box.replaceChildren(...workspaceMembers.map((name, index) => memberChip(name, admin ? () => {
      workspaceMembers.splice(index, 1);
      syncWorkspaceHidden(true);
      renderWorkspaceMembers();
    } : null)));
    const single = $("#workTypeInput")?.value === "individual";
    const maximum = single ? 1 : workspaceMax;
    const full = workspaceMembers.length >= maximum;
    const add = $("#addMemberBtn"), input = $("#memberInput");
    if (add) add.disabled = !admin || full;
    if (input) input.disabled = !admin || full;
    const label = $("#memberEditorLabel"); if (label) label.textContent = single ? "Integrante" : "Integrantes";
    const capacity = $("#capacityState"); if (capacity) capacity.textContent = `${workspaceMembers.length}/${maximum}`;
  }

  function syncWorkspaceHidden(mark = false) {
    workspaceMembers = unique(workspaceMembers);
    const hidden = $("#membersInput"); if (!hidden) return;
    hidden.value = workspaceMembers.join("\n");
    lastHiddenMembers = hidden.value;
    if (mark) hidden.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function addWorkspaceMember() {
    const input = $("#memberInput"); if (!input) return;
    const name = input.value.trim(); if (!name) return;
    const single = $("#workTypeInput")?.value === "individual";
    const maximum = single ? 1 : workspaceMax;
    if (workspaceMembers.length >= maximum) return;
    workspaceMembers.push(name);
    input.value = "";
    syncWorkspaceHidden(true);
    renderWorkspaceMembers();
  }

  function applySettingsToUI(id, setting) {
    if (projectId() !== id) return;
    const end = $("#projectEndInput");
    if (end && document.activeElement !== end) end.value = normalizeDT(setting.project_end_at || "");
    workspaceMax = clampMax(setting.max_members || 1);
    const maxInput = $("#maxMembersInput");
    if (maxInput && document.activeElement !== maxInput) maxInput.value = String(workspaceMax);
    if (Array.isArray(setting.members)) {
      workspaceMembers = setting.members.slice();
      syncWorkspaceHidden(false);
    }
    renderWorkspaceMembers();
  }

  function enforceWorkspaceType() {
    const single = $("#workTypeInput")?.value === "individual";
    const maxInput = $("#maxMembersInput");
    if (single) {
      workspaceMax = 1;
      if (workspaceMembers.length > 1) workspaceMembers = workspaceMembers.slice(0, 1);
      if (maxInput) { maxInput.value = "1"; maxInput.disabled = true; }
      syncWorkspaceHidden(true);
    } else {
      if (workspaceMax < 1) workspaceMax = 6;
      if (maxInput) { maxInput.disabled = !isAdminWorkspace(); maxInput.value = String(Math.max(workspaceMax, workspaceMembers.length, 1)); }
    }
    renderWorkspaceMembers();
  }

  function enforceCreateType() {
    const single = $("#createWorkType")?.value === "individual";
    const max = $("#createMaxMembers"); if (!max) return;
    if (single) { max.value = "1"; max.disabled = true; }
    else { max.disabled = false; if (Number(max.value) <= 1) max.value = "6"; }
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

  async function showJoinRoute() {
    const route = joinRoute(); if (!route) return;
    const dialog = $("#joinDialog"); if (!dialog) return;
    dialog.dataset.projectId = route.id;
    dialog.dataset.joinToken = route.token;
    if (!dialog.open) dialog.showModal();
  }

  async function submitJoin(event) {
    event.preventDefault();
    const dialog = $("#joinDialog");
    const id = dialog?.dataset.projectId || "";
    const joinToken = dialog?.dataset.joinToken || "";
    const name = new FormData(event.currentTarget).get("name")?.toString().trim() || "";
    if (!id || !joinToken || !name) return;
    const button = event.currentTarget.querySelector("button[type=submit]"); if (button) button.disabled = true;
    try {
      const response = await nativeFetch(`${API}/api/projects/${encodeURIComponent(id)}/join-v3`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, join_token: joinToken }),
        cache: "no-store",
      });
      const data = await asJson(response);
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      sessionStorage.setItem(`ucom.participant.${id}`, data.token);
      event.currentTarget.reset(); dialog.close();
      location.hash = `#/p/${encodeURIComponent(id)}`;
    } catch (error) {
      showToast(error.message || "No se pudo ingresar", true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  function showToast(message, error = false) {
    const el = $("#toast"); if (!el) return;
    el.textContent = message;
    el.className = `toast show ${error ? "error" : ""}`;
    setTimeout(() => { if (el.textContent === message) el.className = "toast"; }, 3500);
  }

  function clearQr() {
    qrShareId = "";
    if (qrObjectUrl) URL.revokeObjectURL(qrObjectUrl);
    qrObjectUrl = "";
    const img = $("#shareQrImg"); if (img) img.removeAttribute("src");
    $("#shareQrWrap")?.classList.add("hidden");
  }

  async function loadQr() {
    const id = projectId();
    if (!id || !lastAccess?.share_id || !isAdminWorkspace()) return;
    if (qrShareId === lastAccess.share_id && qrObjectUrl) return;
    try {
      const response = await nativeFetch(`${API}/api/projects/${encodeURIComponent(id)}/share-qr`, { headers: auth(id), cache: "no-store" });
      if (!response.ok) return;
      const blob = await response.blob();
      clearQr();
      qrShareId = lastAccess.share_id;
      qrObjectUrl = URL.createObjectURL(blob);
      const img = $("#shareQrImg"); if (img) img.src = qrObjectUrl;
      $("#shareQrWrap")?.classList.remove("hidden");
    } catch {}
  }

  function syncShareDialog() {
    const dialog = $("#accessDialog"); if (!dialog?.open) return;
    const info = $("#accessInfo");
    if (!lastAccess) {
      if (info) info.textContent = "Sin acceso vigente";
      $("#accessSecret")?.classList.add("hidden");
      clearQr();
      return;
    }
    if (info) info.textContent = `Vence: ${formatDate(lastAccess.expires_at)}`;
    const secret = $("#accessSecret"); if (secret) secret.classList.remove("hidden");
    const link = $("#accessLink"); if (link && lastAccess.join_url) link.textContent = lastAccess.join_url;
    const passwordRow = $("#passwordSecretRow");
    if (passwordRow) passwordRow.classList.toggle("hidden", !lastAccess.password);
    const password = $("#accessPassword"); if (password) password.textContent = lastAccess.password || "";
    loadQr();
  }

  async function refreshParticipants() {
    const id = projectId();
    if (!id || !token(id) || !isAdminWorkspace()) return;
    if ($("#saveState")?.classList.contains("dirty")) return;
    try {
      const response = await nativeFetch(`${API}/api/projects/${encodeURIComponent(id)}/settings`, { headers: auth(id), cache: "no-store" });
      if (!response.ok) return;
      const setting = await asJson(response);
      settingsCache.set(id, setting);
      workspaceMax = clampMax(setting.max_members || workspaceMax);
      if (Array.isArray(setting.members)) {
        workspaceMembers = setting.members.slice();
        syncWorkspaceHidden(false);
        renderWorkspaceMembers();
      }
      const maxInput = $("#maxMembersInput"); if (maxInput && document.activeElement !== maxInput) maxInput.value = String(workspaceMax);
    } catch {}
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
    $("#workTypeInput")?.addEventListener("change", enforceWorkspaceType);
    $("#maxMembersInput")?.addEventListener("input", () => { workspaceMax = clampMax($("#maxMembersInput").value); renderWorkspaceMembers(); markDirty(); });
    $("#createWorkType")?.addEventListener("change", enforceCreateType);
    $("#projectEndInput")?.addEventListener("input", markDirty);
    $("#createAccessMode")?.addEventListener("change", () => toggleCustom("#createAccessMode", "#createAccessCustomWrap"));
    $("#rotateAccessMode")?.addEventListener("change", () => toggleCustom("#rotateAccessMode", "#rotateAccessCustomWrap"));
    $("#createForm")?.addEventListener("reset", () => setTimeout(enforceCreateType, 0));
    $("#joinForm")?.addEventListener("submit", submitJoin);
    $("#chatForm")?.addEventListener("submit", sendChat);
    $("#refreshChatBtn")?.addEventListener("click", () => loadChat(false));
    toggleCustom("#createAccessMode", "#createAccessCustomWrap");
    toggleCustom("#rotateAccessMode", "#rotateAccessCustomWrap");
    enforceCreateType();
    renderWorkspaceMembers();

    setInterval(() => {
      const hidden = $("#membersInput");
      if (hidden && hidden.value !== lastHiddenMembers) {
        lastHiddenMembers = hidden.value;
        workspaceMembers = namesFrom(hidden.value);
        renderWorkspaceMembers();
      }
      const id = projectId();
      const setting = id ? settingsCache.get(id) : null;
      if (setting && $("#projectEndInput") && document.activeElement !== $("#projectEndInput")) {
        const expected = normalizeDT(setting.project_end_at || "");
        if ($("#projectEndInput").value !== expected && !$("#saveState")?.classList.contains("dirty")) $("#projectEndInput").value = expected;
      }
      syncShareDialog();
      document.querySelectorAll(".empty-state").forEach(node => node.remove());
    }, 450);

    setInterval(() => loadChat(false), 3000);
    setInterval(refreshParticipants, 4000);
    window.addEventListener("hashchange", () => {
      lastProjectId = ""; lastChatId = 0;
      setTimeout(() => { loadChat(true); showJoinRoute(); }, 250);
    });
    setTimeout(() => { loadChat(true); showJoinRoute(); }, 500);
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
