import * as Y from "https://cdn.jsdelivr.net/npm/yjs@13.6.32/+esm";
import { WebsocketProvider } from "https://cdn.jsdelivr.net/npm/y-websocket@3.1.0/+esm";

const API = "https://ucom-api.ufotech.com.py";
const WS = "wss://ucom-api.ufotech.com.py/ws";
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
const ACCENTS = {
  purple: "#43358b",
  green: "#00a75d",
  yellow: "#e5a900",
  blue: "#35aada",
  orange: "#f54c27",
};
const AUTO_COLORS = Object.values(ACCENTS);
const $ = (selector, root = document) => root.querySelector(selector);

let currentProject = "";
let ydoc = null;
let yBlocks = null;
let yLayout = null;
let provider = null;
let participants = [];
let me = { role: "participant", name: "Integrante", email: "", identity: "" };
let selectedKey = "";
let cleanup = [];
let participantTimer = 0;
let snapshotTimer = 0;
let legacyTimer = 0;
let legacyObserver = null;
let legacySyncing = false;
let cursorRAF = 0;

const projectId = () => {
  const match = location.hash.match(/^#\/p\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : "";
};
const adminToken = () => sessionStorage.getItem(ADMIN_KEY) || "";
const projectToken = id => adminToken() || sessionStorage.getItem(`ucom.participant.${id}`) || localStorage.getItem(GOOGLE_KEY) || "";
const isAdmin = () => !!adminToken();
const isFinalized = () => $("#workspace")?.classList.contains("task-finalized-v18") || false;

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

function hashColor(value = "") {
  let hash = 0;
  for (const char of value) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return AUTO_COLORS[Math.abs(hash) % AUTO_COLORS.length];
}

function ensureText(block, key, fallback = "") {
  let value = block.get(key);
  if (value instanceof Y.Text) return value;
  const text = new Y.Text(value == null ? fallback : String(value));
  ydoc?.transact(() => block.set(key, text), "ucom-v23-normalize");
  return text;
}

function sortedEntries() {
  if (!yBlocks) return [];
  return [...yBlocks.entries()]
    .filter(([, value]) => value instanceof Y.Map)
    .sort((a, b) => Number(a[1].get("position") || 0) - Number(b[1].get("position") || 0) || a[0].localeCompare(b[0]));
}

function snapshotBlocks() {
  return sortedEntries().map(([id, block]) => ({
    id,
    type: String(block.get("type") || "texto"),
    label: ensureText(block, "label", LABELS[block.get("type")] || "Contenido").toString(),
    title: ensureText(block, "title", LABELS[block.get("type")] || "Texto").toString(),
    body: ensureText(block, "body", "").toString(),
    accent: String(block.get("accent") || "auto"),
  }));
}

function accentColor(block, index) {
  const name = String(block.get("accent") || "auto");
  return name === "auto" ? AUTO_COLORS[index % AUTO_COLORS.length] : (ACCENTS[name] || AUTO_COLORS[index % AUTO_COLORS.length]);
}

function setTopState(text, cls = "") {
  const top = $("#saveState");
  if (!top || top.textContent === "Edición cerrada") return;
  top.textContent = text;
  top.className = `save-state${cls ? ` ${cls}` : ""}`;
}

function ensureUI() {
  const workspace = $("#workspace");
  if (!workspace) return false;
  workspace.classList.add("direct-v23-active");

  const panel = $(".content-panel");
  if (panel && !$("#canvasToolsV23")) {
    const tools = document.createElement("div");
    tools.id = "canvasToolsV23";
    tools.className = "canvas-tools-v23";
    tools.innerHTML = `
      <div class="canvas-tool-title-v23"><strong>Elementos</strong><span id="canvasStatusV23"><i></i> Conectando…</span></div>
      <div class="canvas-add-v23">
        <select id="canvasAddTypeV23">${TYPES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select>
        <button id="canvasAddV23" class="primary" type="button">Agregar</button>
      </div>
      <div id="canvasSelectionV23" class="canvas-selection-v23 hidden">
        <span>Seleccionado</span>
        <select id="canvasSelectedTypeV23">${TYPES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select>
        <div id="canvasAccentV23" class="canvas-accent-v23"></div>
        <div class="canvas-selection-actions-v23"><button id="canvasResetPosV23" class="ghost" type="button">Reubicar</button><button id="canvasDeleteV23" class="ghost danger" type="button">Eliminar</button></div>
      </div>
      <p class="canvas-tip-v23">Escribí directamente sobre la hoja. Usá el asa ⋮⋮ para mover y la esquina para cambiar tamaño.</p>`;
    panel.appendChild(tools);
    $("#canvasAddV23")?.addEventListener("click", addBlock);
    $("#canvasSelectedTypeV23")?.addEventListener("change", changeSelectedType);
    $("#canvasResetPosV23")?.addEventListener("click", resetSelectedPosition);
    $("#canvasDeleteV23")?.addEventListener("click", deleteSelected);
    renderAccentPicker();
  }

  const scroll = $(".preview-scroll");
  if (scroll && !$("#directPaperV23")) {
    const paper = document.createElement("article");
    paper.id = "directPaperV23";
    paper.className = "paper direct-paper-v23 theme-ucom";
    paper.innerHTML = `
      <div class="direct-spectrum-v23"></div>
      <div id="directLayerV23" class="direct-layer-v23"></div>
      <div id="remoteLayerV23" class="remote-layer-v23" aria-hidden="true"></div>
      <div class="direct-footer-v23">UCOM Workspace</div>`;
    scroll.appendChild(paper);
    paper.addEventListener("pointermove", onPaperPointerMove, { passive: true });
    paper.addEventListener("pointerleave", () => provider?.awareness.setLocalStateField("cursorV23", null));
    paper.addEventListener("pointerdown", event => {
      if (event.target === paper || event.target === $("#directLayerV23")) selectItem("");
    });
  }

  ensureRoster();
  bindMetadataInputs();
  observeLegacyPreview();
  return true;
}

function bindMetadataInputs() {
  if (document.body.dataset.directMetaBoundV23 === "1") return;
  document.body.dataset.directMetaBoundV23 = "1";
  ["subjectInput", "titleInput", "professorInput", "dueDateInput"].forEach(id => {
    const input = $("#" + id);
    input?.addEventListener("input", () => renderMeta());
    input?.addEventListener("change", () => renderMeta());
  });
  ["showProfessorV13", "showDueV13", "showMembersV13"].forEach(id => {
    document.addEventListener("change", event => { if (event.target?.id === id) setTimeout(renderAll, 20); });
  });
}

function ensureRoster() {
  const panel = $(".directives-panel");
  if (!panel) return;
  let roster = $("#participantRosterV23");
  if (roster) return;
  roster = document.createElement("section");
  roster.id = "participantRosterV23";
  roster.className = "participant-roster-v23";
  roster.innerHTML = `
    <div class="participant-roster-head-v23"><div><span>Participantes</span><strong id="participantCountV23">0</strong></div><span id="presenceSummaryV23">—</span></div>
    <div id="participantRowsV23" class="participant-rows-v23"></div>
    <div id="participantAddV23" class="participant-add-v23"><input id="participantAddNameV23" maxlength="120" placeholder="Agregar integrante"><button id="participantAddButtonV23" class="ghost" type="button">Agregar</button></div>`;
  const legacy = $(".member-editor", panel);
  if (legacy) panel.insertBefore(roster, legacy); else panel.appendChild(roster);
  $("#participantAddButtonV23")?.addEventListener("click", addManualParticipant);
  $("#participantAddNameV23")?.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); addManualParticipant(); } });
}

function onlineStates() {
  if (!provider) return [];
  return [...provider.awareness.getStates().entries()].map(([clientId, state]) => ({ clientId, ...(state || {}) }));
}

function participantOnline(participant) {
  const email = String(participant.email || "").toLowerCase();
  const name = normalize(participant.name);
  return onlineStates().some(state => {
    const user = state.user || {};
    if (email && String(user.email || "").toLowerCase() === email) return true;
    return !email && name && normalize(user.name) === name;
  });
}

function renderRoster() {
  ensureRoster();
  const rows = $("#participantRowsV23");
  if (!rows) return;
  const admin = isAdmin();
  const online = participants.filter(participantOnline).length;
  $("#participantCountV23").textContent = String(participants.length);
  $("#presenceSummaryV23").textContent = `${online} en línea · ${Math.max(0, participants.length - online)} offline`;
  const add = $("#participantAddV23");
  if (add) add.classList.toggle("hidden", !admin);

  rows.replaceChildren(...participants.map(participant => {
    const isOnline = participantOnline(participant);
    const row = document.createElement("div");
    row.className = "participant-row-v23";
    const dot = document.createElement("i");
    dot.className = isOnline ? "online" : "offline";
    const main = document.createElement("div");
    const name = document.createElement("input");
    name.value = participant.name || "";
    name.readOnly = !admin;
    name.addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); name.blur(); }
      if (event.key === "Escape") { name.value = participant.name || ""; name.blur(); }
    });
    if (admin) name.addEventListener("change", () => renameParticipant(participant.id, name.value));
    const meta = document.createElement("small");
    meta.textContent = participant.email || (participant.source === "manual" ? "Acceso manual" : "");
    main.append(name, meta);
    const status = document.createElement("span");
    status.textContent = isOnline ? "En línea" : "Offline";
    status.className = isOnline ? "online" : "offline";
    row.append(dot, main, status);
    return row;
  }));
}

async function loadParticipants() {
  const id = projectId();
  const authToken = projectToken(id);
  if (!id || !authToken) return;
  try {
    const data = await xhr("GET", `/api/projects/${encodeURIComponent(id)}/participants-v21`, authToken);
    participants = Array.isArray(data.participants) ? data.participants : [];
    me = data.me || me;
    if (provider) provider.awareness.setLocalStateField("user", { name: me.name || "Integrante", email: me.email || "", role: me.role || "participant" });
    renderRoster();
    renderParticipantsOnPaper();
  } catch {}
}

async function renameParticipant(participantId, rawName) {
  const id = projectId();
  const name = String(rawName || "").replace(/\s+/g, " ").trim();
  if (!id || !name || !isAdmin()) return;
  const old = participants.find(item => item.id === participantId)?.name || "";
  if (old === name) return;
  try {
    const data = await xhr("PUT", `/api/projects/${encodeURIComponent(id)}/participants-v21/rename`, adminToken(), { participant_id: participantId, name });
    participants = Array.isArray(data.participants) ? data.participants : participants;
    renderRoster();
    renderParticipantsOnPaper();
    scheduleLegacySync();
  } catch (error) {
    toast(error.message || "No se pudo corregir el nombre", true);
    loadParticipants();
  }
}

async function addManualParticipant() {
  const id = projectId();
  const input = $("#participantAddNameV23");
  const name = input?.value.trim() || "";
  if (!id || !name || !isAdmin()) return;
  try {
    const data = await xhr("POST", `/api/projects/${encodeURIComponent(id)}/participants-v21/manual`, adminToken(), { name });
    participants = Array.isArray(data.participants) ? data.participants : [];
    if (input) input.value = "";
    renderRoster();
    renderParticipantsOnPaper();
    scheduleLegacySync();
  } catch (error) { toast(error.message || "No se pudo agregar", true); }
}

function layoutDefaults(key, index = 0) {
  if (key === "meta:subject") return { x: 58, y: 88, w: 650, h: 24 };
  if (key === "meta:title") return { x: 58, y: 116, w: 650, h: 58 };
  if (key === "meta:professor") return { x: 58, y: 198, w: 210, h: 66 };
  if (key === "meta:due") return { x: 282, y: 198, w: 210, h: 66 };
  if (key.startsWith("participant:")) {
    const col = index % 2;
    const row = Math.floor(index / 2);
    return { x: 506 + col * 116, y: 198 + row * 42, w: 108, h: 36 };
  }
  if (key.startsWith("block:")) {
    const participantRows = Math.max(1, Math.ceil(participants.length / 2));
    const base = 286 + participantRows * 28;
    return { x: 58, y: base + index * 112, w: 650, h: 94 };
  }
  return { x: 58, y: 300, w: 650, h: 80 };
}

function layoutValue(key, defaults) {
  const stored = yLayout?.get(key);
  return stored && typeof stored === "object" ? { ...defaults, ...stored } : { ...defaults };
}

function setLayout(key, value) {
  if (!ydoc || !yLayout || isFinalized()) return;
  ydoc.transact(() => yLayout.set(key, value), "ucom-direct-layout-v23");
}

function applyBox(element, key, defaults) {
  const value = layoutValue(key, defaults);
  element.dataset.directKey = key;
  element.style.left = `${Math.round(value.x)}px`;
  element.style.top = `${Math.round(value.y)}px`;
  element.style.width = `${Math.round(value.w)}px`;
  element.style.minHeight = `${Math.round(value.h)}px`;
  element.classList.toggle("selected", selectedKey === key);
  ensureBoxControls(element, key, defaults);
}

function ensureBoxControls(element, key, defaults) {
  let handle = $(":scope > .direct-drag-v23", element);
  if (!handle) {
    handle = document.createElement("button");
    handle.type = "button";
    handle.className = "direct-drag-v23";
    handle.textContent = "⋮⋮";
    handle.title = "Mover";
    element.prepend(handle);
    handle.addEventListener("pointerdown", event => beginDrag(event, element, key, defaults));
  }
  let resize = $(":scope > .direct-resize-v23", element);
  if (!resize) {
    resize = document.createElement("span");
    resize.className = "direct-resize-v23";
    resize.title = "Cambiar tamaño";
    element.append(resize);
    resize.addEventListener("pointerdown", event => beginResize(event, element, key, defaults));
  }
  const disabled = isFinalized();
  handle.disabled = disabled;
  resize.classList.toggle("hidden", disabled);
  element.addEventListener("pointerdown", event => {
    if (!event.target.closest(".direct-drag-v23,.direct-resize-v23")) selectItem(key);
  });
}

function pageScale() {
  const paper = $("#directPaperV23");
  if (!paper) return 1;
  return paper.getBoundingClientRect().width / 794 || 1;
}

function beginDrag(event, element, key, defaults) {
  if (isFinalized()) return;
  event.preventDefault();
  event.stopPropagation();
  selectItem(key);
  const start = layoutValue(key, defaults);
  const scale = pageScale();
  const sx = event.clientX, sy = event.clientY;
  const move = e => {
    const x = Math.max(0, Math.min(794 - 40, start.x + (e.clientX - sx) / scale));
    const y = Math.max(0, Math.min(1123 - 30, start.y + (e.clientY - sy) / scale));
    element.style.left = `${Math.round(x / 4) * 4}px`;
    element.style.top = `${Math.round(y / 4) * 4}px`;
  };
  const end = e => {
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", end, true);
    const x = Math.round((start.x + (e.clientX - sx) / scale) / 4) * 4;
    const y = Math.round((start.y + (e.clientY - sy) / scale) / 4) * 4;
    setLayout(key, { ...start, x: Math.max(0, Math.min(754, x)), y: Math.max(0, Math.min(1093, y)) });
  };
  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", end, true);
}

function beginResize(event, element, key, defaults) {
  if (isFinalized()) return;
  event.preventDefault();
  event.stopPropagation();
  selectItem(key);
  const start = layoutValue(key, defaults);
  const scale = pageScale();
  const sx = event.clientX, sy = event.clientY;
  const move = e => {
    const w = Math.max(90, Math.min(794 - start.x, start.w + (e.clientX - sx) / scale));
    const h = Math.max(36, Math.min(1123 - start.y, start.h + (e.clientY - sy) / scale));
    element.style.width = `${Math.round(w / 4) * 4}px`;
    element.style.minHeight = `${Math.round(h / 4) * 4}px`;
  };
  const end = e => {
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", end, true);
    const w = Math.round(Math.max(90, Math.min(794 - start.x, start.w + (e.clientX - sx) / scale)) / 4) * 4;
    const h = Math.round(Math.max(36, Math.min(1123 - start.y, start.h + (e.clientY - sy) / scale)) / 4) * 4;
    setLayout(key, { ...start, w, h });
  };
  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", end, true);
}

function selectItem(key) {
  selectedKey = key || "";
  document.querySelectorAll("#directPaperV23 [data-direct-key]").forEach(el => el.classList.toggle("selected", el.dataset.directKey === selectedKey));
  renderSelectionTools();
  provider?.awareness.setLocalStateField("selectionV23", selectedKey || null);
}

function renderSelectionTools() {
  const box = $("#canvasSelectionV23");
  if (!box) return;
  const isBlock = selectedKey.startsWith("block:");
  box.classList.toggle("hidden", !isBlock);
  if (!isBlock) return;
  const id = selectedKey.slice(6);
  const block = yBlocks?.get(id);
  if (!(block instanceof Y.Map)) return;
  $("#canvasSelectedTypeV23").value = String(block.get("type") || "texto");
  $("#canvasAccentV23")?.querySelectorAll("button[data-accent]").forEach(button => button.classList.toggle("active", button.dataset.accent === String(block.get("accent") || "auto")));
}

function renderAccentPicker() {
  const box = $("#canvasAccentV23");
  if (!box) return;
  const entries = [["auto", "Auto", ""], ...Object.entries(ACCENTS).map(([key, color]) => [key, key, color])];
  box.replaceChildren(...entries.map(([key, title, color]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.accent = key;
    button.title = title;
    button.className = "canvas-accent-dot-v23";
    if (color) button.style.setProperty("--dot", color); else button.textContent = "A";
    button.addEventListener("click", () => {
      if (!selectedKey.startsWith("block:") || isFinalized()) return;
      const block = yBlocks?.get(selectedKey.slice(6));
      if (!(block instanceof Y.Map)) return;
      ydoc.transact(() => block.set("accent", key), "ucom-direct-v23");
    });
    return button;
  }));
}

function addBlock() {
  if (!yBlocks || isFinalized()) return;
  const type = $("#canvasAddTypeV23")?.value || "texto";
  const id = crypto.randomUUID ? crypto.randomUUID() : `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const positions = sortedEntries().map(([, block]) => Number(block.get("position") || 0));
  const block = new Y.Map();
  block.set("id", id);
  block.set("type", type);
  block.set("accent", "auto");
  block.set("position", positions.length ? Math.max(...positions) + 1000 : 0);
  block.set("label", new Y.Text(LABELS[type] || "Contenido"));
  block.set("title", new Y.Text(LABELS[type] || "Texto"));
  block.set("body", new Y.Text(""));
  ydoc.transact(() => yBlocks.set(id, block), "ucom-direct-v23");
  selectedKey = `block:${id}`;
  setTimeout(() => $(`#directPaperV23 [data-block-id="${CSS.escape(id)}"] .direct-block-body-v23`)?.focus(), 40);
}

function changeSelectedType() {
  if (!selectedKey.startsWith("block:") || isFinalized()) return;
  const block = yBlocks?.get(selectedKey.slice(6));
  if (!(block instanceof Y.Map)) return;
  const next = $("#canvasSelectedTypeV23")?.value || "texto";
  const old = String(block.get("type") || "texto");
  const oldDefault = LABELS[old] || "Texto";
  const label = ensureText(block, "label", oldDefault);
  const title = ensureText(block, "title", oldDefault);
  ydoc.transact(() => {
    block.set("type", next);
    const nextDefault = LABELS[next] || "Texto";
    if (label.toString() === oldDefault) replaceYText(label, nextDefault);
    if (title.toString() === oldDefault) replaceYText(title, nextDefault);
  }, "ucom-direct-v23");
}

function resetSelectedPosition() {
  if (!yLayout || !selectedKey || isFinalized()) return;
  ydoc.transact(() => yLayout.delete(selectedKey), "ucom-direct-layout-v23");
}

function deleteSelected() {
  if (!selectedKey.startsWith("block:") || isFinalized()) return;
  const id = selectedKey.slice(6);
  const block = yBlocks?.get(id);
  if (!(block instanceof Y.Map)) return;
  const title = ensureText(block, "title", "").toString();
  if (!confirm(`¿Eliminar ${title || "este bloque"}?`)) return;
  ydoc.transact(() => {
    yBlocks.delete(id);
    yLayout.delete(`block:${id}`);
  }, "ucom-direct-v23");
  selectedKey = "";
  renderSelectionTools();
}

function replaceYText(ytext, value) {
  if (ytext.length) ytext.delete(0, ytext.length);
  if (value) ytext.insert(0, value);
}

function applyTextDiff(ytext, before, after) {
  let prefix = 0;
  const common = Math.min(before.length, after.length);
  while (prefix < common && before[prefix] === after[prefix]) prefix += 1;
  let oldEnd = before.length, newEnd = after.length;
  while (oldEnd > prefix && newEnd > prefix && before[oldEnd - 1] === after[newEnd - 1]) { oldEnd--; newEnd--; }
  if (oldEnd > prefix) ytext.delete(prefix, oldEnd - prefix);
  if (newEnd > prefix) ytext.insert(prefix, after.slice(prefix, newEnd));
}

function bindEditable(element, ytext, blockId, field) {
  const editable = !isFinalized();
  element.contentEditable = editable ? "true" : "false";
  element.spellcheck = field !== "formula";
  if (element.dataset.boundV23 === "1") return;
  element.dataset.boundV23 = "1";
  element.textContent = ytext.toString();

  const localInput = () => {
    if (isFinalized()) return;
    const before = ytext.toString();
    const after = element.innerText.replace(/\r/g, "");
    if (before === after) return;
    ydoc.transact(() => applyTextDiff(ytext, before, after), "ucom-direct-text-v23");
  };
  const focus = () => provider?.awareness.setLocalStateField("editing", { blockId, field });
  const blur = () => {
    const current = provider?.awareness.getLocalState()?.editing;
    if (current?.blockId === blockId && current?.field === field) provider?.awareness.setLocalStateField("editing", null);
  };
  const remote = () => {
    const next = ytext.toString();
    if (document.activeElement === element) return;
    if (element.innerText !== next) element.textContent = next;
  };
  element.addEventListener("input", localInput);
  element.addEventListener("focus", focus);
  element.addEventListener("blur", blur);
  ytext.observe(remote);
  cleanup.push(() => {
    element.removeEventListener("input", localInput);
    element.removeEventListener("focus", focus);
    element.removeEventListener("blur", blur);
    ytext.unobserve(remote);
  });
}

function renderAll() {
  renderMeta();
  renderParticipantsOnPaper();
  renderBlocks();
  renderRoster();
  renderRemoteCursors();
  syncDesignFromLegacy();
  scheduleLegacySync();
}

function upsertDirectItem(key, className) {
  const layer = $("#directLayerV23");
  if (!layer) return null;
  let element = layer.querySelector(`[data-direct-key="${CSS.escape(key)}"]`);
  if (!element) {
    element = document.createElement("section");
    element.className = `direct-item-v23 ${className}`;
    layer.appendChild(element);
  }
  return element;
}

function editableMeta(element, inputId, allowEdit = true) {
  const input = $("#" + inputId);
  const target = $(".direct-value-v23", element);
  if (!input || !target) return;
  const editable = allowEdit && isAdmin() && !isFinalized();
  target.contentEditable = editable ? "true" : "false";
  if (document.activeElement !== target) target.textContent = input.value || "";
  if (target.dataset.metaBoundV23 !== "1") {
    target.dataset.metaBoundV23 = "1";
    target.addEventListener("input", () => {
      if (!isAdmin() || isFinalized()) return;
      input.value = target.innerText.replace(/\n+/g, " ").trimStart();
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
}

function renderMeta() {
  const layer = $("#directLayerV23");
  if (!layer) return;
  const showProfessor = $("#showProfessorV13") ? $("#showProfessorV13").checked : !$("#professorInput")?.closest("label")?.classList.contains("hidden");
  const showDue = $("#showDueV13") ? $("#showDueV13").checked : !$("#dueDateInput")?.closest("label")?.classList.contains("hidden");

  const subject = upsertDirectItem("meta:subject", "direct-subject-v23");
  if (subject && !$(".direct-value-v23", subject)) subject.innerHTML += '<div class="direct-value-v23"></div>';
  if (subject) { applyBox(subject, "meta:subject", layoutDefaults("meta:subject")); editableMeta(subject, "subjectInput", true); }

  const title = upsertDirectItem("meta:title", "direct-title-v23");
  if (title && !$(".direct-value-v23", title)) title.innerHTML += '<div class="direct-value-v23"></div>';
  if (title) { applyBox(title, "meta:title", layoutDefaults("meta:title")); editableMeta(title, "titleInput", true); }

  const professor = upsertDirectItem("meta:professor", "direct-meta-v23");
  if (professor && !$(".direct-value-v23", professor)) professor.innerHTML += '<span class="direct-label-v23">Profesor/a</span><div class="direct-value-v23"></div>';
  if (professor) {
    professor.classList.toggle("hidden", !showProfessor);
    applyBox(professor, "meta:professor", layoutDefaults("meta:professor"));
    editableMeta(professor, "professorInput", true);
  }

  const due = upsertDirectItem("meta:due", "direct-meta-v23");
  if (due && !$(".direct-value-v23", due)) due.innerHTML += '<span class="direct-label-v23">Entrega</span><div class="direct-value-v23"></div>';
  if (due) {
    due.classList.toggle("hidden", !showDue);
    applyBox(due, "meta:due", layoutDefaults("meta:due"));
    const raw = $("#dueDateInput")?.value || "";
    const value = $(".direct-value-v23", due);
    if (value) value.textContent = raw ? new Date(raw).toLocaleString("es-PY", { dateStyle: "medium", timeStyle: "short" }) : "—";
    value?.setAttribute("contenteditable", "false");
  }
}

function renderParticipantsOnPaper() {
  const layer = $("#directLayerV23");
  if (!layer) return;
  const showMembers = $("#showMembersV13") ? $("#showMembersV13").checked : true;
  const wanted = new Set(participants.map(p => `participant:${p.id}`));
  layer.querySelectorAll('[data-direct-key^="participant:"]').forEach(el => { if (!wanted.has(el.dataset.directKey)) el.remove(); });
  participants.forEach((participant, index) => {
    const key = `participant:${participant.id}`;
    const element = upsertDirectItem(key, "direct-participant-v23");
    if (!element) return;
    element.classList.toggle("hidden", !showMembers);
    if (!$(".direct-participant-name-v23", element)) element.innerHTML += '<span class="direct-participant-role-v23">Integrante</span><div class="direct-participant-name-v23"></div><i class="direct-participant-dot-v23"></i>';
    applyBox(element, key, layoutDefaults(key, index));
    const name = $(".direct-participant-name-v23", element);
    const editable = isAdmin() && !isFinalized();
    name.contentEditable = editable ? "true" : "false";
    name.spellcheck = false;
    if (document.activeElement !== name) name.textContent = participant.name || "Integrante";
    if (name.dataset.participantBoundV23 !== "1") {
      name.dataset.participantBoundV23 = "1";
      name.addEventListener("keydown", event => {
        if (event.key === "Enter") { event.preventDefault(); name.blur(); }
        if (event.key === "Escape") { name.textContent = participant.name || ""; name.blur(); }
      });
      name.addEventListener("blur", () => renameParticipant(participant.id, name.textContent));
    }
    const dot = $(".direct-participant-dot-v23", element);
    dot.className = `direct-participant-dot-v23 ${participantOnline(participant) ? "online" : "offline"}`;
    dot.title = participantOnline(participant) ? "En línea" : "Offline";
  });
}

function renderBlocks() {
  const layer = $("#directLayerV23");
  if (!layer || !yBlocks) return;
  const entries = sortedEntries();
  const wanted = new Set(entries.map(([id]) => `block:${id}`));
  layer.querySelectorAll('[data-direct-key^="block:"]').forEach(el => { if (!wanted.has(el.dataset.directKey)) el.remove(); });

  entries.forEach(([id, block], index) => {
    const key = `block:${id}`;
    const type = String(block.get("type") || "texto");
    const element = upsertDirectItem(key, `direct-block-v23 type-${type}`);
    if (!element) return;
    element.dataset.blockId = id;
    element.className = `direct-item-v23 direct-block-v23 type-${type}${selectedKey === key ? " selected" : ""}`;
    element.style.setProperty("--block-accent", accentColor(block, index));
    if (!$(".direct-block-label-v23", element)) {
      const label = document.createElement("div"); label.className = "direct-block-label-v23";
      const title = document.createElement("div"); title.className = "direct-block-title-v23";
      const body = document.createElement("div"); body.className = "direct-block-body-v23";
      element.append(label, title, body);
    }
    applyBox(element, key, layoutDefaults(key, index));
    bindEditable($(".direct-block-label-v23", element), ensureText(block, "label", LABELS[type] || "Contenido"), id, "label");
    bindEditable($(".direct-block-title-v23", element), ensureText(block, "title", LABELS[type] || "Texto"), id, "title");
    bindEditable($(".direct-block-body-v23", element), ensureText(block, "body", ""), id, type === "formula" ? "formula" : "body");
  });
  renderSelectionTools();
}

function onPaperPointerMove(event) {
  if (!provider || cursorRAF) return;
  cursorRAF = requestAnimationFrame(() => {
    cursorRAF = 0;
    const paper = $("#directPaperV23");
    if (!paper) return;
    const rect = paper.getBoundingClientRect();
    const scale = rect.width / 794 || 1;
    provider.awareness.setLocalStateField("cursorV23", {
      x: Math.round((event.clientX - rect.left) / scale),
      y: Math.round((event.clientY - rect.top) / scale),
    });
  });
}

function renderRemoteCursors() {
  const layer = $("#remoteLayerV23");
  if (!layer || !ydoc) return;
  const states = onlineStates().filter(state => state.clientId !== ydoc.clientID && state.cursorV23 && state.user);
  layer.replaceChildren(...states.map(state => {
    const cursor = document.createElement("div");
    cursor.className = "remote-cursor-v23";
    cursor.style.left = `${state.cursorV23.x}px`;
    cursor.style.top = `${state.cursorV23.y}px`;
    cursor.style.setProperty("--presence", hashColor(state.user.email || state.user.name || String(state.clientId)));
    cursor.innerHTML = `<i></i><span>${escapeHtml(state.user.name || "Integrante")}</span>`;
    return cursor;
  }));
  const selections = new Map(states.filter(s => s.selectionV23).map(s => [s.selectionV23, s.user?.name || "Integrante"]));
  document.querySelectorAll("#directPaperV23 [data-direct-key]").forEach(el => {
    const editorName = selections.get(el.dataset.directKey);
    el.dataset.remoteEditor = editorName || "";
    el.classList.toggle("remote-selected-v23", !!editorName);
  });
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
}

function scheduleSnapshot() {
  clearTimeout(snapshotTimer);
  snapshotTimer = setTimeout(() => flushSnapshot(false), 900);
}

function isSnapshotLeader() {
  if (!provider || !ydoc) return true;
  const ids = [...provider.awareness.getStates().keys()];
  return !ids.length || ydoc.clientID === Math.min(...ids);
}

async function flushSnapshot(force = true) {
  const id = projectId();
  const authToken = projectToken(id);
  if (!id || !authToken || !yBlocks) return false;
  if (!force && !isSnapshotLeader()) return true;
  try {
    await xhr("PUT", `/api/projects/${encodeURIComponent(id)}/blocks-v15`, authToken, { blocks: snapshotBlocks() });
    setTopState("En vivo", "saved");
    return true;
  } catch (error) {
    if (error.status === 423) return false;
    setTopState("Sin conexión", "dirty");
    return false;
  }
}

function setConnectionStatus(status) {
  const box = $("#canvasStatusV23");
  if (box) {
    box.className = status;
    box.innerHTML = `<i></i> ${status === "connected" ? "En vivo" : status === "connecting" ? "Conectando…" : "Reconectando…"}`;
  }
  setTopState(status === "connected" ? "En vivo" : "Reconectando", status === "connected" ? "saved" : "saving");
}

function syncDesignFromLegacy() {
  const legacy = $("#previewPaper"), direct = $("#directPaperV23");
  if (!legacy || !direct) return;
  const keep = ["theme-ucom","theme-minimal","theme-visual","theme-math","design-v13","design-institutional-v13","design-monograph-v13","design-activity-v13","has-spectrum-v13","no-footer-v13"];
  keep.forEach(cls => direct.classList.toggle(cls, legacy.classList.contains(cls)));
  ["--design-primary","--design-secondary"].forEach(prop => {
    const value = legacy.style.getPropertyValue(prop);
    if (value) direct.style.setProperty(prop, value); else direct.style.removeProperty(prop);
  });
}

function observeLegacyPreview() {
  if (legacyObserver) return;
  const legacy = $("#previewPaper");
  if (!legacy) return;
  legacyObserver = new MutationObserver(() => {
    if (legacySyncing) return;
    syncDesignFromLegacy();
    scheduleLegacySync();
  });
  legacyObserver.observe(legacy, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
}

function scheduleLegacySync() {
  clearTimeout(legacyTimer);
  legacyTimer = setTimeout(syncLegacyPreview, 120);
}

function syncLegacyPreview() {
  const root = $("#previewPaper");
  if (!root || !yBlocks) return;
  legacySyncing = true;
  try {
    root.querySelector(".doc-blocks-v15")?.remove();
    const wrapper = document.createElement("div");
    wrapper.className = "doc-blocks-v15";
    snapshotBlocks().forEach((block, index) => {
      const section = document.createElement("section");
      section.className = `doc-block-v15 type-${block.type}`;
      section.style.setProperty("--block-accent", block.accent === "auto" ? AUTO_COLORS[index % AUTO_COLORS.length] : (ACCENTS[block.accent] || AUTO_COLORS[index % AUTO_COLORS.length]));
      if (block.label.trim()) { const label = document.createElement("span"); label.className = "doc-block-label-v15"; label.textContent = block.label; section.append(label); }
      if (block.title.trim()) { const title = document.createElement("h3"); title.textContent = block.title; section.append(title); }
      const body = document.createElement("div"); body.className = "doc-block-body-v15"; body.textContent = block.type === "formula" && block.body.trim() ? `\\[${block.body}\\]` : block.body; section.append(body);
      wrapper.append(section);
    });
    const footer = root.querySelector(".doc-footer");
    if (footer) root.insertBefore(wrapper, footer); else root.append(wrapper);
    root.querySelectorAll(".doc-meta > div").forEach(row => {
      const label = normalize(row.querySelector("span")?.textContent || "");
      if (!label.startsWith("integrante")) return;
      const value = row.querySelector("strong");
      if (!value) return;
      value.replaceChildren(...participants.flatMap((participant, index) => {
        const span = document.createElement("span"); span.textContent = participant.name || "Integrante"; span.style.display = "block";
        return index ? [span] : [span];
      }));
    });
    if (window.MathJax?.typesetPromise) {
      try { window.MathJax.typesetClear?.([wrapper]); window.MathJax.typesetPromise([wrapper]).catch(() => {}); } catch {}
    }
  } finally {
    legacySyncing = false;
  }
}

async function connectProject(id) {
  destroyRealtime();
  const authToken = projectToken(id);
  if (!id || !authToken || !ensureUI()) return;
  currentProject = id;
  await loadParticipants();
  ydoc = new Y.Doc();
  yBlocks = ydoc.getMap("blocks");
  yLayout = ydoc.getMap("layout-v23");
  provider = new WebsocketProvider(WS, id, ydoc, { params: { token: authToken } });
  provider.awareness.setLocalStateField("user", { name: me.name || "Integrante", email: me.email || "", role: me.role || "participant" });

  provider.on("status", event => setConnectionStatus(event.status));
  provider.on("sync", synced => {
    if (!synced) return;
    renderAll();
    scheduleSnapshot();
  });
  provider.awareness.on("change", () => {
    renderRoster();
    renderParticipantsOnPaper();
    renderRemoteCursors();
  });
  yBlocks.observeDeep(() => {
    renderBlocks();
    renderSelectionTools();
    scheduleSnapshot();
    scheduleLegacySync();
  });
  yLayout.observeDeep(() => renderAll());
  ydoc.on("update", () => scheduleSnapshot());

  clearInterval(participantTimer);
  participantTimer = setInterval(loadParticipants, 4000);
  renderAll();
}

function destroyRealtime() {
  clearInterval(participantTimer);
  clearTimeout(snapshotTimer);
  clearTimeout(legacyTimer);
  cleanup.forEach(fn => { try { fn(); } catch {} });
  cleanup = [];
  try { provider?.destroy(); } catch {}
  try { ydoc?.destroy(); } catch {}
  provider = null;
  ydoc = null;
  yBlocks = null;
  yLayout = null;
  participants = [];
  currentProject = "";
  selectedKey = "";
  $("#canvasToolsV23")?.remove();
  $("#participantRosterV23")?.remove();
  $("#directPaperV23")?.remove();
  $("#workspace")?.classList.remove("direct-v23-active");
}

function routeSync() {
  const id = projectId();
  if (!id) { if (currentProject) destroyRealtime(); return; }
  if (id === currentProject && provider) return;
  setTimeout(() => connectProject(id), 450);
}

function init() {
  window.addEventListener("hashchange", routeSync);
  window.addEventListener("ucom:lifecycle-v18", () => setTimeout(renderAll, 20));
  window.addEventListener("resize", () => renderRemoteCursors());
  setTimeout(routeSync, 800);
}

window.UCOMRealtimeV21 = {
  flush: () => flushSnapshot(true),
  getState: () => ({ projectId: currentProject, connected: !!provider?.wsconnected, blocks: snapshotBlocks(), participants }),
};
window.UCOMDirectCanvasV23 = {
  refreshParticipants: loadParticipants,
  renameParticipant,
  select: selectItem,
  getState: () => ({ projectId: currentProject, connected: !!provider?.wsconnected, selectedKey, blocks: snapshotBlocks(), participants }),
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
