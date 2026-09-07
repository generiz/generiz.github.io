import * as Y from "https://cdn.jsdelivr.net/npm/yjs@13.6.32/+esm";
import { WebsocketProvider } from "https://cdn.jsdelivr.net/npm/y-websocket@3.1.0/+esm";

const API = "https://ucom-api.ufotech.com.py";
const WS = "wss://ucom-api.ufotech.com.py/ws";
const ADMIN_KEY = "ucom.admin.session.v2";
const GOOGLE_KEY = "ucom.google.session.v11";
const $ = (selector, root = document) => root.querySelector(selector);

let currentProject = "";
let doc = null;
let provider = null;
let layout = null;
let participants = [];
let me = { role: "participant", name: "Integrante", email: "" };
let previewObserver = null;
let participantTimer = 0;
let applyTimer = 0;
let editMode = false;
let dragState = null;

const projectId = () => {
  const match = location.hash.match(/^#\/p\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : "";
};
const adminToken = () => sessionStorage.getItem(ADMIN_KEY) || "";
const projectToken = id => adminToken() || sessionStorage.getItem(`ucom.participant.${id}`) || localStorage.getItem(GOOGLE_KEY) || "";
const isAdmin = () => !!adminToken();

function xhr(method, path, authToken = "", body) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(method, `${API}${path}`, true);
    request.setRequestHeader("Accept", "application/json");
    if (body !== undefined) request.setRequestHeader("Content-Type", "application/json");
    if (authToken) request.setRequestHeader("Authorization", `Bearer ${authToken}`);
    request.onreadystatechange = () => {
      if (request.readyState !== 4) return;
      let data = {};
      try { data = request.responseText ? JSON.parse(request.responseText) : {}; } catch {}
      if (request.status >= 200 && request.status < 300) resolve(data);
      else reject(Object.assign(new Error(data.error || `HTTP ${request.status || 0}`), { status: request.status, data }));
    };
    request.onerror = () => reject(new Error("No se pudo conectar con el servidor"));
    request.send(body === undefined ? null : JSON.stringify(body));
  });
}

function toast(message, error = false) {
  const box = $("#toast");
  if (!box) return;
  box.textContent = message;
  box.className = `toast show ${error ? "error" : ""}`;
  setTimeout(() => { if (box.textContent === message) box.className = "toast"; }, 3000);
}

function normalize(value = "") {
  return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase();
}

function onlineStates() {
  if (!provider) return [];
  return [...provider.awareness.getStates().values()].filter(state => state?.user?.name || state?.user?.email);
}

function participantOnline(participant) {
  const email = String(participant.email || "").trim().toLowerCase();
  const name = normalize(participant.name);
  return onlineStates().some(state => {
    const user = state.user || {};
    if (email && String(user.email || "").trim().toLowerCase() === email) return true;
    return !email && name && normalize(user.name) === name;
  });
}

function ensureRoster() {
  const panel = $(".directives-panel");
  if (!panel) return null;
  let roster = $("#participantRosterV22");
  if (roster) return roster;
  roster = document.createElement("section");
  roster.id = "participantRosterV22";
  roster.className = "participant-roster-v22";
  roster.innerHTML = `
    <div class="participant-roster-head-v22">
      <div><span class="participant-roster-kicker-v22">Participantes</span><strong id="participantCountV22">0</strong></div>
      <span id="participantPresenceSummaryV22" class="participant-presence-summary-v22">—</span>
    </div>
    <div id="participantRowsV22" class="participant-rows-v22"></div>`;
  const legacy = $(".member-editor", panel);
  if (legacy) panel.insertBefore(roster, legacy); else panel.appendChild(roster);
  return roster;
}

function renderRoster() {
  ensureRoster();
  const rows = $("#participantRowsV22");
  if (!rows) return;
  const admin = isAdmin();
  const onlineCount = participants.filter(participantOnline).length;
  $("#participantCountV22").textContent = String(participants.length);
  $("#participantPresenceSummaryV22").textContent = `${onlineCount} en línea · ${Math.max(0, participants.length - onlineCount)} offline`;

  const nodes = participants.map(participant => {
    const online = participantOnline(participant);
    const row = document.createElement("div");
    row.className = "participant-row-v22";
    row.dataset.participantId = participant.id;

    const dot = document.createElement("span");
    dot.className = `participant-dot-v22 ${online ? "online" : "offline"}`;
    dot.title = online ? "En línea" : "Offline";

    const main = document.createElement("div");
    main.className = "participant-main-v22";
    const name = document.createElement("input");
    name.className = "participant-name-v22";
    name.value = participant.name || "";
    name.readOnly = !admin;
    name.title = admin ? "Podés corregir este nombre" : participant.name || "";
    name.addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); name.blur(); }
      if (event.key === "Escape") { name.value = participant.name || ""; name.blur(); }
    });
    if (admin) name.addEventListener("change", () => renameParticipant(participant.id, name.value));
    const detail = document.createElement("small");
    detail.textContent = participant.email || (participant.source === "manual" ? "Acceso manual" : "");
    main.append(name, detail);

    const status = document.createElement("span");
    status.className = `participant-status-v22 ${online ? "online" : "offline"}`;
    status.textContent = online ? "En línea" : "Offline";

    row.append(dot, main, status);
    if (admin) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "participant-remove-v22";
      remove.textContent = "×";
      remove.title = `Quitar a ${participant.name}`;
      remove.addEventListener("click", () => removeParticipant(participant));
      row.append(remove);
    }
    return row;
  });
  rows.replaceChildren(...nodes);
  syncDocumentParticipants();
}

async function loadParticipants() {
  const id = projectId();
  const authToken = projectToken(id);
  if (!id || !authToken) return;
  try {
    const data = await xhr("GET", `/api/projects/${encodeURIComponent(id)}/participants-v21`, authToken);
    participants = Array.isArray(data.participants) ? data.participants : [];
    me = data.me || me;
    renderRoster();
  } catch {}
}

async function renameParticipant(participantId, rawName) {
  const id = projectId();
  const name = String(rawName || "").trim();
  if (!id || !name || !isAdmin()) return;
  const previous = participants.find(item => item.id === participantId)?.name || "";
  if (name === previous) return;
  try {
    const data = await xhr("PUT", `/api/projects/${encodeURIComponent(id)}/participants-v21/rename`, adminToken(), {
      participant_id: participantId,
      name,
    });
    participants = Array.isArray(data.participants) ? data.participants : participants;
    renderRoster();
    toast("Nombre actualizado");
  } catch (error) {
    toast(error.message || "No se pudo corregir el nombre", true);
    await loadParticipants();
  }
}

async function removeParticipant(participant) {
  const id = projectId();
  if (!id || !isAdmin()) return;
  if (!confirm(`¿Quitar a ${participant.name} de la tarea?`)) return;
  try {
    const data = await xhr("DELETE", `/api/projects/${encodeURIComponent(id)}/participants-v21/${encodeURIComponent(participant.id)}`, adminToken());
    participants = Array.isArray(data.participants) ? data.participants : [];
    renderRoster();
  } catch (error) { toast(error.message || "No se pudo quitar", true); }
}

function membersMetaRow(root = $("#previewPaper")) {
  if (!root) return null;
  return [...root.querySelectorAll(".doc-meta > div")].find(row => {
    const label = normalize(row.querySelector("span")?.textContent || "");
    return label.startsWith("integrante");
  }) || null;
}

function syncDocumentParticipants() {
  const row = membersMetaRow();
  const value = row?.querySelector("strong");
  if (!value) return;
  const admin = isAdmin();
  const fragment = document.createDocumentFragment();
  if (!participants.length) {
    fragment.append(document.createTextNode("—"));
  } else {
    participants.forEach((participant, index) => {
      const span = document.createElement("span");
      span.className = `doc-participant-v22${admin ? " editable" : ""}`;
      span.dataset.participantId = participant.id;
      span.textContent = participant.name || "Integrante";
      if (admin) {
        span.contentEditable = "true";
        span.spellcheck = false;
        span.title = "Editar nombre";
        span.addEventListener("keydown", event => {
          if (event.key === "Enter") { event.preventDefault(); span.blur(); }
          if (event.key === "Escape") { span.textContent = participant.name || ""; span.blur(); }
        });
        span.addEventListener("blur", () => renameParticipant(participant.id, span.textContent));
      }
      fragment.append(span);
      if (index < participants.length - 1) fragment.append(document.createTextNode(", "));
    });
  }
  value.replaceChildren(fragment);
}

function ensureLayoutButton() {
  const head = $(".preview-head");
  if (!head) return;
  let button = $("#layoutEditV22");
  if (button) return;
  button = document.createElement("button");
  button.id = "layoutEditV22";
  button.type = "button";
  button.className = "ghost layout-edit-button-v22";
  button.textContent = "Editar hoja";
  button.addEventListener("click", () => setEditMode(!editMode));
  head.appendChild(button);
}

function setEditMode(enabled) {
  if ($("#workspace")?.classList.contains("task-finalized-v18")) enabled = false;
  editMode = !!enabled;
  const paper = $("#previewPaper");
  paper?.classList.toggle("layout-edit-v22", editMode);
  const button = $("#layoutEditV22");
  if (button) {
    button.classList.toggle("active", editMode);
    button.textContent = editMode ? "Listo" : "Editar hoja";
  }
  scheduleApplyLayout();
}

function layoutValue(key, defaults) {
  const raw = layout?.get(key);
  if (!raw || typeof raw !== "object") return { ...defaults };
  return { ...defaults, ...raw };
}

function setLayoutValue(key, patch, defaults = {}) {
  if (!layout || !doc) return;
  const next = { ...layoutValue(key, defaults), ...patch };
  doc.transact(() => layout.set(key, next), "ucom-layout-v22");
}

function layoutKeyForMeta(row) {
  const label = normalize(row.querySelector("span")?.textContent || "");
  if (label.startsWith("profesor")) return "meta:professor";
  if (label === "entrega") return "meta:due";
  if (label.startsWith("integrante")) return "meta:members";
  return `meta:${label || "other"}`;
}

function blockIdsFromRealtime() {
  try { return window.UCOMRealtimeV21?.getState?.().blocks?.map(block => block.id) || []; }
  catch { return []; }
}

function applyLayout() {
  const paper = $("#previewPaper");
  if (!paper || !layout) return;
  ensureLayoutButton();
  paper.classList.toggle("layout-edit-v22", editMode);

  const meta = paper.querySelector(".doc-meta");
  if (meta) {
    const rows = [...meta.children].filter(row => row instanceof HTMLElement && getComputedStyle(row).display !== "none");
    const defaultSpan = rows.length <= 1 ? 12 : rows.length === 2 ? 6 : rows.length === 3 ? 4 : 3;
    decorateGroup(meta, rows.map((row, index) => ({
      element: row,
      key: layoutKeyForMeta(row),
      defaults: { order: (index + 1) * 100, span: defaultSpan },
      group: "meta",
      minSpan: 3,
    })));
  }

  const blockWrap = paper.querySelector(".doc-blocks-v15");
  if (blockWrap) {
    const ids = blockIdsFromRealtime();
    const sections = [...blockWrap.querySelectorAll(":scope > .doc-block-v15")];
    decorateGroup(blockWrap, sections.map((section, index) => ({
      element: section,
      key: `block:${ids[index] || index}`,
      defaults: { order: (index + 1) * 100, span: 12 },
      group: "blocks",
      minSpan: 4,
    })));
  }
  syncDocumentParticipants();
}

function decorateGroup(container, items) {
  if (!items.length) return;
  const hasStored = items.some(item => layout.has(item.key));
  container.classList.toggle("layout-grid-v22", editMode || hasStored);
  items.forEach(item => {
    const value = layoutValue(item.key, item.defaults);
    const element = item.element;
    element.dataset.layoutKeyV22 = item.key;
    element.dataset.layoutGroupV22 = item.group;
    element.style.order = String(Number(value.order) || item.defaults.order);
    if (editMode || hasStored) element.style.gridColumn = `span ${Math.max(item.minSpan, Math.min(12, Number(value.span) || item.defaults.span))}`;
    else element.style.removeProperty("grid-column");
    element.draggable = editMode;
    element.classList.toggle("layout-item-v22", editMode);
    if (editMode) installLayoutControls(element, item, container);
    else removeLayoutControls(element);
  });
}

function installLayoutControls(element, item, container) {
  if (!element.querySelector(":scope > .layout-drag-v22")) {
    const drag = document.createElement("button");
    drag.type = "button";
    drag.className = "layout-drag-v22";
    drag.textContent = "⠿";
    drag.title = "Arrastrar";
    drag.tabIndex = -1;
    element.prepend(drag);
  }
  if (!element.querySelector(":scope > .layout-resize-v22")) {
    const resize = document.createElement("span");
    resize.className = "layout-resize-v22";
    resize.title = "Arrastrar para cambiar el ancho";
    resize.addEventListener("pointerdown", event => beginResize(event, element, item, container));
    element.appendChild(resize);
  }
  if (element.dataset.layoutDragBoundV22 !== "1") {
    element.dataset.layoutDragBoundV22 = "1";
    element.addEventListener("dragstart", onDragStart);
    element.addEventListener("dragover", onDragOver);
    element.addEventListener("drop", onDrop);
    element.addEventListener("dragend", () => { dragState = null; document.body.classList.remove("layout-dragging-v22"); });
  }
}

function removeLayoutControls(element) {
  element.querySelector(":scope > .layout-drag-v22")?.remove();
  element.querySelector(":scope > .layout-resize-v22")?.remove();
  element.classList.remove("layout-item-v22", "layout-drop-v22");
  element.draggable = false;
}

function onDragStart(event) {
  if (!editMode) { event.preventDefault(); return; }
  const item = event.currentTarget;
  dragState = { key: item.dataset.layoutKeyV22, group: item.dataset.layoutGroupV22 };
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", dragState.key || "");
  document.body.classList.add("layout-dragging-v22");
}

function onDragOver(event) {
  if (!dragState || event.currentTarget.dataset.layoutGroupV22 !== dragState.group) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function onDrop(event) {
  if (!dragState) return;
  const target = event.currentTarget;
  const group = target.dataset.layoutGroupV22;
  if (group !== dragState.group) return;
  event.preventDefault();
  const container = target.parentElement;
  const items = [...container.querySelectorAll(":scope > [data-layout-key-v22]")]
    .sort((a, b) => Number(a.style.order || 0) - Number(b.style.order || 0));
  const dragged = items.find(item => item.dataset.layoutKeyV22 === dragState.key);
  if (!dragged || dragged === target) return;
  const next = items.filter(item => item !== dragged);
  next.splice(next.indexOf(target), 0, dragged);
  doc.transact(() => {
    next.forEach((item, index) => {
      const key = item.dataset.layoutKeyV22;
      const current = layoutValue(key, { order: (index + 1) * 100, span: 12 });
      layout.set(key, { ...current, order: (index + 1) * 100 });
    });
  }, "ucom-layout-v22");
  dragState = null;
}

function beginResize(event, element, item, container) {
  if (!editMode) return;
  event.preventDefault();
  event.stopPropagation();
  const startX = event.clientX;
  const startWidth = element.getBoundingClientRect().width;
  const containerWidth = Math.max(1, container.getBoundingClientRect().width);
  let span = Math.max(item.minSpan, Math.min(12, Number(layoutValue(item.key, item.defaults).span) || item.defaults.span));
  const pointerId = event.pointerId;
  event.currentTarget.setPointerCapture?.(pointerId);

  const move = moveEvent => {
    const width = Math.max(40, startWidth + (moveEvent.clientX - startX));
    span = Math.max(item.minSpan, Math.min(12, Math.round((width / containerWidth) * 12)));
    element.style.gridColumn = `span ${span}`;
  };
  const end = () => {
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", end, true);
    window.removeEventListener("pointercancel", end, true);
    setLayoutValue(item.key, { span }, item.defaults);
  };
  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", end, true);
  window.addEventListener("pointercancel", end, true);
}

function scheduleApplyLayout() {
  clearTimeout(applyTimer);
  applyTimer = setTimeout(applyLayout, 30);
}

function observePreview() {
  previewObserver?.disconnect();
  const paper = $("#previewPaper");
  if (!paper) return;
  previewObserver = new MutationObserver(() => scheduleApplyLayout());
  previewObserver.observe(paper, { childList: true, subtree: true });
}

async function connect(id) {
  destroy();
  const authToken = projectToken(id);
  if (!id || !authToken) return;
  currentProject = id;
  ensureRoster();
  ensureLayoutButton();
  await loadParticipants();

  doc = new Y.Doc();
  layout = doc.getMap("layout-v22");
  provider = new WebsocketProvider(WS, id, doc, { params: { token: authToken } });
  provider.awareness.setLocalStateField("v22", { auxiliary: true });
  provider.on("sync", synced => { if (synced) scheduleApplyLayout(); });
  provider.awareness.on("change", () => renderRoster());
  layout.observeDeep(() => scheduleApplyLayout());
  observePreview();
  clearInterval(participantTimer);
  participantTimer = setInterval(loadParticipants, 4000);
  scheduleApplyLayout();
}

function destroy() {
  clearInterval(participantTimer);
  clearTimeout(applyTimer);
  previewObserver?.disconnect();
  previewObserver = null;
  try { provider?.destroy(); } catch {}
  try { doc?.destroy(); } catch {}
  provider = null;
  doc = null;
  layout = null;
  participants = [];
  currentProject = "";
  editMode = false;
  $("#participantRosterV22")?.remove();
  $("#layoutEditV22")?.remove();
}

function routeSync() {
  const id = projectId();
  if (!id) { if (currentProject) destroy(); return; }
  if (id === currentProject && provider) return;
  setTimeout(() => connect(id), 450);
}

function init() {
  window.addEventListener("hashchange", routeSync);
  window.addEventListener("ucom:lifecycle-v18", event => {
    if (event.detail?.finalized) setEditMode(false);
  });
  setTimeout(routeSync, 900);
}

window.UCOMDocumentEditV22 = {
  refreshParticipants: loadParticipants,
  renameParticipant,
  setEditMode,
  getState: () => ({ projectId: currentProject, editMode, participants: participants.slice() }),
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
