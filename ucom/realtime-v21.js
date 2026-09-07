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
let ydoc = null;
let yBlocks = null;
let provider = null;
let participants = [];
let me = { role: "participant", name: "Integrante", email: "", identity: "" };
let cleanupBindings = [];
let snapshotTimer = 0;
let participantTimer = 0;
let previewTimer = 0;
let structureTimer = 0;
let pendingStructure = false;
let previewRendering = false;

const projectId = () => {
  const m = location.hash.match(/^#\/p\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : "";
};
const adminToken = () => sessionStorage.getItem(ADMIN_KEY) || "";
const token = id => adminToken() || sessionStorage.getItem(`ucom.participant.${id}`) || localStorage.getItem(GOOGLE_KEY) || "";
const isAdmin = () => !!adminToken();

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
  setTimeout(() => { if (el.textContent === message) el.className = "toast"; }, 3000);
}

function normalize(value = "") {
  return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase();
}

function randomId() {
  return crypto.randomUUID ? crypto.randomUUID() : `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function accentColor(block, index) {
  const name = String(block.get("accent") || "auto");
  return name !== "auto" ? (ACCENTS[name] || AUTO_COLORS[index % AUTO_COLORS.length]) : AUTO_COLORS[index % AUTO_COLORS.length];
}

function sortedEntries() {
  if (!yBlocks) return [];
  return [...yBlocks.entries()]
    .filter(([, value]) => value instanceof Y.Map)
    .sort((a, b) => Number(a[1].get("position") || 0) - Number(b[1].get("position") || 0) || a[0].localeCompare(b[0]));
}

function ensureText(block, key, fallback = "") {
  let value = block.get(key);
  if (value instanceof Y.Text) return value;
  const text = new Y.Text(value == null ? fallback : String(value));
  ydoc.transact(() => block.set(key, text), "ucom-normalize");
  return text;
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

function installEditor() {
  const panel = $(".content-panel");
  if (!panel) return false;
  $("#workspace")?.classList.add("realtime-v21-active");
  panel.classList.add("blocks-mode-v15", "realtime-editor-v21");
  $(".directives-panel")?.classList.add("blocks-v15-active");
  $("#blocksEditorV15")?.remove();

  const editor = document.createElement("div");
  editor.id = "blocksEditorV15";
  editor.className = "blocks-editor-v15 realtime-editor-inner-v21";
  editor.innerHTML = `
    <div class="blocks-toolbar-v15 realtime-toolbar-v21">
      <div class="blocks-add-v15">
        <select id="blockTypeAddV21" aria-label="Formato del bloque">
          ${TYPES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
        </select>
        <button id="addBlockV21" class="ghost" type="button">+ Agregar</button>
        <span id="realtimeStatusV21" class="realtime-status-v21"><i></i><span>Conectando…</span></span>
      </div>
      <span id="blocksCountV21" class="blocks-count-v15"></span>
    </div>
    <div id="blocksListV21" class="blocks-list-v15"></div>`;
  panel.appendChild(editor);
  $("#addBlockV21")?.addEventListener("click", addBlock);
  return true;
}

function clearBindings() {
  cleanupBindings.forEach(fn => { try { fn(); } catch {} });
  cleanupBindings = [];
}

function renderEditor() {
  if (!yBlocks) return;
  const list = $("#blocksListV21");
  if (!list) return;
  clearBindings();
  const entries = sortedEntries();
  $("#blocksCountV21").textContent = `${entries.length} ${entries.length === 1 ? "bloque" : "bloques"}`;
  if (!entries.length) {
    list.innerHTML = '<div class="blocks-empty-v15">Agregá el primer bloque.</div>';
    return;
  }
  list.replaceChildren(...entries.map(([id, block], index) => blockNode(id, block, index, entries)));
  renderEditingBadges();
}

function blockNode(id, block, index, entries) {
  const card = document.createElement("section");
  card.className = "block-card-v15 realtime-card-v21";
  card.dataset.id = id;
  card.style.setProperty("--block-accent", accentColor(block, index));

  const head = document.createElement("div");
  head.className = "block-head-v15";

  const type = document.createElement("select");
  type.setAttribute("aria-label", "Formato");
  const currentType = String(block.get("type") || "texto");
  TYPES.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = value === currentType;
    type.appendChild(option);
  });
  type.addEventListener("change", () => {
    const oldType = String(block.get("type") || "texto");
    const oldDefault = LABELS[oldType] || "Texto";
    const label = ensureText(block, "label", oldDefault);
    const title = ensureText(block, "title", oldDefault);
    ydoc.transact(() => {
      block.set("type", type.value);
      const nextDefault = LABELS[type.value] || "Texto";
      if (label.toString() === oldDefault) replaceYText(label, nextDefault);
      if (title.toString() === oldDefault) replaceYText(title, nextDefault);
    }, "ucom-ui");
  });

  const title = document.createElement("input");
  title.className = "block-title-v15";
  title.maxLength = 180;
  title.placeholder = "Título opcional";
  bindText(title, ensureText(block, "title", LABELS[currentType] || "Texto"), id, "title");

  const actions = document.createElement("div");
  actions.className = "block-actions-v15";
  actions.append(
    iconButton("↑", "Subir", () => moveBlock(index, -1), index === 0),
    iconButton("↓", "Bajar", () => moveBlock(index, 1), index === entries.length - 1),
    iconButton("×", "Eliminar", () => removeBlock(id, block), false, true),
  );
  head.append(type, title, actions);

  const body = document.createElement("textarea");
  body.className = "block-body-v15";
  body.spellcheck = currentType !== "formula";
  body.placeholder = currentType === "formula" ? "Ej.: \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}" : "Escribí aquí…";
  bindText(body, ensureText(block, "body", ""), id, "body", true);

  const foot = document.createElement("div");
  foot.className = "block-foot-v15 realtime-foot-v21";

  const labelWrap = document.createElement("label");
  labelWrap.className = "block-label-wrap-v19";
  labelWrap.innerHTML = '<span>Etiqueta</span>';
  const labelInput = document.createElement("input");
  labelInput.className = "block-label-input-v19";
  labelInput.maxLength = 100;
  labelInput.placeholder = "Sin etiqueta";
  bindText(labelInput, ensureText(block, "label", LABELS[currentType] || "Contenido"), id, "label");
  labelWrap.append(labelInput);

  const presence = document.createElement("div");
  presence.className = "block-presence-v21";
  presence.dataset.blockPresence = id;

  const picker = document.createElement("div");
  picker.className = "accent-picker-v15";
  picker.append(accentButton("auto", "Auto", block));
  Object.keys(ACCENTS).forEach(name => picker.append(accentButton(name, name, block)));
  foot.append(labelWrap, presence, picker);

  const observeMap = () => {
    card.style.setProperty("--block-accent", accentColor(block, index));
    const wantedType = String(block.get("type") || "texto");
    if (document.activeElement !== type) type.value = wantedType;
    picker.querySelectorAll("[data-accent]").forEach(btn => btn.classList.toggle("active", btn.dataset.accent === String(block.get("accent") || "auto")));
    schedulePreview();
  };
  block.observe(observeMap);
  cleanupBindings.push(() => block.unobserve(observeMap));

  card.append(head, body, foot);
  return card;
}

function bindText(input, ytext, blockId, field, autoGrow = false) {
  input.value = ytext.toString();
  if (autoGrow) requestAnimationFrame(() => autoHeight(input));

  const onInput = () => {
    const before = ytext.toString();
    const after = input.value;
    if (before === after) return;
    ydoc.transact(() => applyTextDiff(ytext, before, after), "ucom-ui");
    if (autoGrow) autoHeight(input);
  };
  const onFocus = () => setEditing(blockId, field);
  const onBlur = () => clearEditing(blockId, field);
  const onRemote = () => {
    const next = ytext.toString();
    if (input.value === next) return;
    const old = input.value;
    const start = input.selectionStart ?? old.length;
    const end = input.selectionEnd ?? start;
    const mappedStart = mapSelection(old, next, start);
    const mappedEnd = mapSelection(old, next, end);
    input.value = next;
    try { input.setSelectionRange(mappedStart, mappedEnd); } catch {}
    if (autoGrow) autoHeight(input);
  };
  input.addEventListener("input", onInput);
  input.addEventListener("focus", onFocus);
  input.addEventListener("blur", onBlur);
  ytext.observe(onRemote);
  cleanupBindings.push(() => {
    input.removeEventListener("input", onInput);
    input.removeEventListener("focus", onFocus);
    input.removeEventListener("blur", onBlur);
    ytext.unobserve(onRemote);
  });
}

function applyTextDiff(ytext, before, after) {
  let prefix = 0;
  const common = Math.min(before.length, after.length);
  while (prefix < common && before[prefix] === after[prefix]) prefix += 1;
  let oldEnd = before.length;
  let newEnd = after.length;
  while (oldEnd > prefix && newEnd > prefix && before[oldEnd - 1] === after[newEnd - 1]) {
    oldEnd -= 1;
    newEnd -= 1;
  }
  if (oldEnd > prefix) ytext.delete(prefix, oldEnd - prefix);
  if (newEnd > prefix) ytext.insert(prefix, after.slice(prefix, newEnd));
}

function replaceYText(ytext, value) {
  if (ytext.length) ytext.delete(0, ytext.length);
  if (value) ytext.insert(0, value);
}

function mapSelection(oldText, newText, position) {
  let prefix = 0;
  const common = Math.min(oldText.length, newText.length);
  while (prefix < common && oldText[prefix] === newText[prefix]) prefix += 1;
  let oldEnd = oldText.length;
  let newEnd = newText.length;
  while (oldEnd > prefix && newEnd > prefix && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd -= 1;
    newEnd -= 1;
  }
  if (position <= prefix) return position;
  if (position >= oldEnd) return Math.max(0, Math.min(newText.length, position + (newEnd - prefix) - (oldEnd - prefix)));
  return newEnd;
}

function autoHeight(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(420, Math.max(72, textarea.scrollHeight))}px`;
}

function iconButton(text, title, handler, disabled = false, danger = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `block-icon-v15${danger ? " danger" : ""}`;
  button.textContent = text;
  button.title = title;
  button.disabled = disabled;
  button.addEventListener("click", handler);
  return button;
}

function accentButton(name, title, block) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.accent = name;
  button.title = title;
  button.className = name === "auto" ? "accent-dot-v15 accent-auto-v15" : "accent-dot-v15";
  if (String(block.get("accent") || "auto") === name) button.classList.add("active");
  if (name === "auto") button.textContent = "Auto";
  else button.style.setProperty("--dot", ACCENTS[name]);
  button.addEventListener("click", () => ydoc.transact(() => block.set("accent", name), "ucom-ui"));
  return button;
}

function addBlock() {
  if (!yBlocks || $("#workspace")?.classList.contains("task-finalized-v18")) return;
  const type = $("#blockTypeAddV21")?.value || "desarrollo";
  const id = randomId();
  const positions = sortedEntries().map(([, block]) => Number(block.get("position") || 0));
  const position = positions.length ? Math.max(...positions) + 1000 : 0;
  const block = new Y.Map();
  block.set("id", id);
  block.set("type", type);
  block.set("accent", "auto");
  block.set("position", position);
  block.set("label", new Y.Text(LABELS[type] || "Contenido"));
  block.set("title", new Y.Text(LABELS[type] || "Texto"));
  block.set("body", new Y.Text(""));
  ydoc.transact(() => yBlocks.set(id, block), "ucom-ui");
  setTimeout(() => $("#blocksListV21 .realtime-card-v21:last-child .block-body-v15")?.focus(), 40);
}

function moveBlock(index, delta) {
  const entries = sortedEntries();
  const target = index + delta;
  if (target < 0 || target >= entries.length) return;
  const a = entries[index][1];
  const b = entries[target][1];
  const pa = Number(a.get("position") || 0);
  const pb = Number(b.get("position") || 0);
  ydoc.transact(() => {
    a.set("position", pb);
    b.set("position", pa);
  }, "ucom-ui");
}

function removeBlock(id, block) {
  const body = ensureText(block, "body", "").toString();
  const title = ensureText(block, "title", "").toString();
  if ((body.trim() || title.trim()) && !confirm(`¿Eliminar ${title || "este bloque"}?`)) return;
  ydoc.transact(() => yBlocks.delete(id), "ucom-ui");
}

function setEditing(blockId, field) {
  if (!provider) return;
  provider.awareness.setLocalStateField("editing", { blockId, field });
}
function clearEditing(blockId, field) {
  if (!provider) return;
  const current = provider.awareness.getLocalState()?.editing;
  if (current?.blockId === blockId && current?.field === field) provider.awareness.setLocalStateField("editing", null);
}

function onlineStates() {
  if (!provider) return [];
  return [...provider.awareness.getStates().entries()].map(([clientId, state]) => ({ clientId, ...(state || {}) }));
}

function renderEditingBadges() {
  const states = onlineStates();
  document.querySelectorAll("[data-block-presence]").forEach(box => {
    const blockId = box.dataset.blockPresence;
    const editors = states
      .filter(state => state.editing?.blockId === blockId && state.clientId !== ydoc?.clientID)
      .map(state => state.user?.name || "Integrante");
    box.replaceChildren(...[...new Set(editors)].map(name => {
      const badge = document.createElement("span");
      badge.className = "editing-badge-v21";
      badge.textContent = `${name} editando`;
      return badge;
    }));
  });
}

function scheduleStructureRender() {
  clearTimeout(structureTimer);
  structureTimer = setTimeout(() => {
    const list = $("#blocksListV21");
    if (list?.contains(document.activeElement)) {
      pendingStructure = true;
      return;
    }
    pendingStructure = false;
    renderEditor();
  }, 40);
}

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 18);
}

function renderPreview() {
  if (!yBlocks || previewRendering) return;
  const root = $("#previewPaper");
  if (!root) return;
  previewRendering = true;
  try {
    root.querySelector(".doc-directives")?.setAttribute("hidden", "");
    root.querySelector(".doc-body")?.setAttribute("hidden", "");
    root.querySelector(".doc-blocks-v15")?.remove();
    const wrapper = document.createElement("div");
    wrapper.className = "doc-blocks-v15";
    snapshotBlocks().forEach((block, index) => {
      const section = document.createElement("section");
      section.className = `doc-block-v15 type-${block.type}`;
      section.style.setProperty("--block-accent", block.accent !== "auto" ? (ACCENTS[block.accent] || AUTO_COLORS[index % AUTO_COLORS.length]) : AUTO_COLORS[index % AUTO_COLORS.length]);
      if (block.label.trim()) {
        const label = document.createElement("span");
        label.className = "doc-block-label-v15";
        label.textContent = block.label;
        section.append(label);
      }
      if (block.title.trim()) {
        const heading = document.createElement("h3");
        heading.textContent = block.title;
        section.append(heading);
      }
      const body = document.createElement("div");
      body.className = "doc-block-body-v15";
      const raw = block.body || "";
      const trimmed = raw.trim();
      const delimited = /^(\\\[|\\\(|\$\$|\$)/.test(trimmed);
      body.textContent = block.type === "formula" && trimmed && !delimited ? `\\[${raw}\\]` : raw;
      section.append(body);
      wrapper.append(section);
    });
    const footer = root.querySelector(".doc-footer");
    if (footer) root.insertBefore(wrapper, footer); else root.append(wrapper);
    if (window.MathJax?.typesetPromise) {
      try { window.MathJax.typesetClear?.([wrapper]); window.MathJax.typesetPromise([wrapper]).catch(() => {}); } catch {}
    }
    syncParticipantsIntoDocument();
  } finally {
    previewRendering = false;
  }
}

function isSnapshotLeader() {
  if (!provider || !ydoc) return true;
  const ids = [...provider.awareness.getStates().keys()];
  if (!ids.length) return true;
  return ydoc.clientID === Math.min(...ids);
}

function scheduleSnapshot() {
  if (!isSnapshotLeader()) return;
  clearTimeout(snapshotTimer);
  snapshotTimer = setTimeout(() => flushSnapshot(false), 900);
}

async function flushSnapshot(force = true) {
  const id = projectId();
  const authToken = token(id);
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

function setTopState(text, cls = "") {
  const top = $("#saveState");
  if (top && top.textContent !== "Edición cerrada") {
    top.textContent = text;
    top.className = `save-state${cls ? ` ${cls}` : ""}`;
  }
}

function setRealtimeStatus(status) {
  const box = $("#realtimeStatusV21");
  if (!box) return;
  const label = $("span", box);
  box.dataset.state = status;
  if (label) label.textContent = status === "connected" ? "En vivo" : status === "connecting" ? "Conectando…" : "Reconectando…";
  setTopState(status === "connected" ? "En vivo" : "Reconectando", status === "connected" ? "saved" : "saving");
}

async function loadParticipants() {
  const id = projectId();
  const authToken = token(id);
  if (!id || !authToken) return;
  try {
    const data = await xhr("GET", `/api/projects/${encodeURIComponent(id)}/participants-v21`, authToken);
    participants = Array.isArray(data.participants) ? data.participants : [];
    me = data.me || me;
    if (provider) provider.awareness.setLocalStateField("user", { name: me.name || "Integrante", email: me.email || "", role: me.role || "participant" });
    renderParticipants();
    syncParticipantsIntoDocument();
  } catch {}
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

function renderParticipants() {
  const box = $("#membersList");
  if (!box) return;
  box.classList.add("participants-list-v21");
  const admin = isAdmin();
  const nodes = participants.map(participant => {
    const row = document.createElement("div");
    row.className = "participant-row-v21";
    row.dataset.participantId = participant.id;
    const dot = document.createElement("span");
    const online = participantOnline(participant);
    dot.className = `presence-dot-v21 ${online ? "online" : "offline"}`;
    dot.title = online ? "En línea" : "Sin conexión";
    const main = document.createElement("div");
    main.className = "participant-main-v21";
    const name = document.createElement("input");
    name.value = participant.name || "";
    name.readOnly = !admin;
    name.className = "participant-name-v21";
    name.setAttribute("aria-label", `Nombre de ${participant.name || "integrante"}`);
    if (admin) name.addEventListener("change", () => renameParticipant(participant.id, name.value));
    const meta = document.createElement("small");
    meta.textContent = participant.email || (participant.source === "manual" ? "Acceso manual" : "");
    main.append(name, meta);
    const status = document.createElement("span");
    status.className = "participant-status-v21";
    status.textContent = online ? "En línea" : "Offline";
    row.append(dot, main, status);
    if (admin) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "participant-remove-v21";
      remove.textContent = "×";
      remove.title = "Quitar integrante";
      remove.addEventListener("click", () => removeParticipant(participant));
      row.append(remove);
    }
    return row;
  });
  box.replaceChildren(...nodes);
  const label = $("#memberEditorLabel");
  if (label) label.textContent = "Participantes";
  const max = Number($("#maxMembersInput")?.value || 0);
  const capacity = $("#capacityState");
  if (capacity) capacity.textContent = max ? `${participants.length}/${max}` : `${participants.length}`;
  const add = $("#addMemberBtn"), input = $("#memberInput");
  if (add) add.disabled = !admin || (max > 0 && participants.length >= max);
  if (input) input.disabled = !admin || (max > 0 && participants.length >= max);
}

async function renameParticipant(participantId, value) {
  const id = projectId();
  const name = String(value || "").trim();
  if (!id || !name || !isAdmin()) return;
  try {
    const data = await xhr("PUT", `/api/projects/${encodeURIComponent(id)}/participants-v21/rename`, adminToken(), { participant_id: participantId, name });
    participants = data.participants || participants;
    renderParticipants();
    syncParticipantsIntoDocument();
  } catch (error) {
    toast(error.message || "No se pudo corregir el nombre", true);
    loadParticipants();
  }
}

async function removeParticipant(participant) {
  const id = projectId();
  if (!id || !isAdmin()) return;
  if (!confirm(`¿Quitar a ${participant.name}?`)) return;
  try {
    const data = await xhr("DELETE", `/api/projects/${encodeURIComponent(id)}/participants-v21/${encodeURIComponent(participant.id)}`, adminToken());
    participants = data.participants || [];
    renderParticipants();
    syncParticipantsIntoDocument();
  } catch (error) { toast(error.message || "No se pudo quitar", true); }
}

async function addManualParticipant() {
  const id = projectId();
  const input = $("#memberInput");
  const name = input?.value.trim() || "";
  if (!id || !name || !isAdmin()) return;
  try {
    const data = await xhr("POST", `/api/projects/${encodeURIComponent(id)}/participants-v21/manual`, adminToken(), { name });
    participants = data.participants || [];
    if (input) input.value = "";
    renderParticipants();
    syncParticipantsIntoDocument();
  } catch (error) { toast(error.message || "No se pudo agregar", true); }
}

function syncParticipantsIntoDocument() {
  const names = participants.map(item => item.name).filter(Boolean);
  const hidden = $("#membersInput");
  if (hidden) hidden.value = names.join("\n");
  const root = $("#previewPaper");
  root?.querySelectorAll(".doc-meta > div").forEach(row => {
    const label = (row.querySelector("span")?.textContent || "").trim().toLowerCase();
    if (!label.startsWith("integrantes")) return;
    const value = row.querySelector("strong");
    if (value) value.textContent = names.join(", ") || "—";
  });
}

function renderPresence() {
  renderParticipants();
  renderEditingBadges();
}

async function connectProject(id) {
  destroyRealtime();
  const authToken = token(id);
  if (!authToken) return;
  currentProject = id;
  if (!installEditor()) return;
  await loadParticipants();

  ydoc = new Y.Doc();
  yBlocks = ydoc.getMap("blocks");
  provider = new WebsocketProvider(WS, id, ydoc, { params: { token: authToken } });
  provider.awareness.setLocalStateField("user", { name: me.name || "Integrante", email: me.email || "", role: me.role || "participant" });

  provider.on("status", event => setRealtimeStatus(event.status));
  provider.on("sync", synced => {
    if (!synced) return;
    renderEditor();
    renderPreview();
    renderPresence();
    scheduleSnapshot();
  });
  provider.awareness.on("change", () => {
    renderPresence();
    if (isSnapshotLeader()) scheduleSnapshot();
  });
  yBlocks.observe(() => scheduleStructureRender());
  ydoc.on("update", () => {
    schedulePreview();
    scheduleSnapshot();
    if (pendingStructure && !$("#blocksListV21")?.contains(document.activeElement)) scheduleStructureRender();
  });

  const preview = $("#previewPaper");
  if (preview) {
    const observer = new MutationObserver(() => {
      if (!previewRendering && yBlocks && !preview.querySelector(".doc-blocks-v15")) schedulePreview();
    });
    observer.observe(preview, { childList: true, subtree: true });
    cleanupBindings.push(() => observer.disconnect());
  }

  clearInterval(participantTimer);
  participantTimer = setInterval(loadParticipants, 5000);
}

function destroyRealtime() {
  clearTimeout(snapshotTimer);
  clearTimeout(previewTimer);
  clearTimeout(structureTimer);
  clearInterval(participantTimer);
  clearBindings();
  try { provider?.destroy(); } catch {}
  try { ydoc?.destroy(); } catch {}
  provider = null;
  ydoc = null;
  yBlocks = null;
  currentProject = "";
  participants = [];
}

function routeSync() {
  const id = projectId();
  if (!id) {
    if (currentProject) destroyRealtime();
    return;
  }
  if (id === currentProject && provider) return;
  setTimeout(() => connectProject(id), 350);
}

function interceptLegacyMembers() {
  document.addEventListener("click", event => {
    if (!event.target.closest("#addMemberBtn")) return;
    if (!$("#workspace")?.classList.contains("realtime-v21-active")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    addManualParticipant();
  }, true);
}

function init() {
  interceptLegacyMembers();
  window.addEventListener("hashchange", routeSync);
  window.addEventListener("ucom:lifecycle-v18", event => {
    if (event.detail?.finalized) {
      flushSnapshot(true).finally(() => provider?.disconnect());
    } else if (projectId() && provider && !provider.wsconnected) {
      provider.connect();
    }
  });
  setTimeout(routeSync, 700);
}

window.UCOMRealtimeV21 = {
  flush: () => flushSnapshot(true),
  getState: () => ({ projectId: currentProject, connected: !!provider?.wsconnected, blocks: snapshotBlocks(), participants }),
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
