import * as Y from "https://cdn.jsdelivr.net/npm/yjs@13.6.32/+esm";
import { WebsocketProvider } from "https://cdn.jsdelivr.net/npm/y-websocket@3.1.0/+esm";

const WS = "wss://ucom-api.ufotech.com.py/ws";
const ADMIN_KEY = "ucom.admin.session.v2";
const GOOGLE_KEY = "ucom.google.session.v11";
const $ = (selector, root = document) => root.querySelector(selector);

const FONTS = {
  system: { label: "Sistema", css: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  arial: { label: "Arial", css: 'Arial, Helvetica, sans-serif' },
  georgia: { label: "Georgia", css: 'Georgia, "Times New Roman", serif' },
  times: { label: "Times", css: '"Times New Roman", Times, serif' },
  verdana: { label: "Verdana", css: 'Verdana, Geneva, sans-serif' },
  trebuchet: { label: "Trebuchet", css: '"Trebuchet MS", Arial, sans-serif' },
  mono: { label: "Mono", css: '"SFMono-Regular", Consolas, "Liberation Mono", monospace' },
};
const SIZES = [8,9,10,11,12,13,14,16,18,20,22,24,28,32,36,40,44,48,56,64];

let project = "";
let ydoc = null;
let provider = null;
let styles = null;
let displayNames = null;
let selectedKey = "";
let participantSignature = "";
let participantTimer = 0;
let legacyObserver = null;
let legacyTimer = 0;

const projectId = () => {
  const match = location.hash.match(/^#\/p\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : "";
};
const token = id => sessionStorage.getItem(ADMIN_KEY) || sessionStorage.getItem(`ucom.participant.${id}`) || localStorage.getItem(GOOGLE_KEY) || "";
const finalized = () => $("#workspace")?.classList.contains("task-finalized-v18") || false;
const participants = () => window.UCOMDirectCanvasV23?.getState?.().participants || [];

function styleDefaults(key) {
  if (key === "meta:title") return { fontFamily: "system", fontSize: 31 };
  if (key === "meta:subject") return { fontFamily: "system", fontSize: 10 };
  if (key === "meta:members") return { fontFamily: "system", fontSize: 10 };
  if (key.startsWith("meta:")) return { fontFamily: "system", fontSize: 12 };
  if (key.startsWith("block:")) return { fontFamily: "system", fontSize: 11 };
  return { fontFamily: "system", fontSize: 11 };
}

function styleValue(key) {
  const base = styleDefaults(key);
  const stored = styles?.get(key);
  return stored && typeof stored === "object" ? { ...base, ...stored } : base;
}

function patchStyle(key, patch) {
  if (!styles || !ydoc || !key || finalized()) return;
  const current = styles.get(key);
  const next = { ...(current && typeof current === "object" ? current : {}), ...patch };
  ydoc.transact(() => styles.set(key, next), "ucom-paper-style-v24");
}

function ensureToolbar() {
  const host = $("#canvasToolsV23");
  if (!host || $("#typographyV24")) return;
  const box = document.createElement("div");
  box.id = "typographyV24";
  box.className = "typography-v24 hidden";
  box.innerHTML = `
    <span class="typography-title-v24">Texto</span>
    <div class="typography-grid-v24">
      <label>Fuente<select id="fontFamilyV24">${Object.entries(FONTS).map(([value, font]) => `<option value="${value}">${font.label}</option>`).join("")}</select></label>
      <label>Tamaño<select id="fontSizeV24">${SIZES.map(size => `<option value="${size}">${size} px</option>`).join("")}</select></label>
    </div>`;
  const selection = $("#canvasSelectionV23", host);
  if (selection) selection.after(box); else host.appendChild(box);
  $("#fontFamilyV24")?.addEventListener("change", event => patchStyle(selectedKey, { fontFamily: event.target.value }));
  $("#fontSizeV24")?.addEventListener("change", event => patchStyle(selectedKey, { fontSize: Number(event.target.value) || styleDefaults(selectedKey).fontSize }));
}

function select(key) {
  selectedKey = key || "";
  const box = $("#typographyV24");
  if (!box) return;
  const supported = selectedKey === "meta:members" || selectedKey.startsWith("meta:") || selectedKey.startsWith("block:");
  box.classList.toggle("hidden", !supported);
  if (!supported) return;
  const value = styleValue(selectedKey);
  const family = $("#fontFamilyV24"), size = $("#fontSizeV24");
  if (family) family.value = FONTS[value.fontFamily] ? value.fontFamily : "system";
  if (size) {
    const numeric = Number(value.fontSize) || styleDefaults(selectedKey).fontSize;
    if (![...size.options].some(option => Number(option.value) === numeric)) {
      const option = document.createElement("option");
      option.value = String(numeric); option.textContent = `${numeric} px`; size.appendChild(option);
    }
    size.value = String(numeric);
  }
}

function typographyTarget(key) {
  const paper = $("#directPaperV23");
  return paper?.querySelector(`[data-direct-key="${CSS.escape(key)}"]`) || null;
}

function applyTypography(key) {
  const element = typographyTarget(key);
  if (!element) return;
  const value = styleValue(key);
  const font = FONTS[value.fontFamily] || FONTS.system;
  const size = Math.max(7, Math.min(96, Number(value.fontSize) || styleDefaults(key).fontSize));
  element.style.fontFamily = font.css;
  if (key.startsWith("block:")) {
    const label = $(".direct-block-label-v23", element), title = $(".direct-block-title-v23", element), body = $(".direct-block-body-v23", element);
    if (body) { body.style.fontFamily = font.css; body.style.fontSize = `${size}px`; }
    if (title) { title.style.fontFamily = font.css; title.style.fontSize = `${Math.max(10, size + 3)}px`; }
    if (label) { label.style.fontFamily = font.css; label.style.fontSize = `${Math.max(7, Math.round(size * .72))}px`; }
    return;
  }
  if (key === "meta:members") {
    element.querySelectorAll(".participant-display-name-v24").forEach(line => { line.style.fontFamily = font.css; line.style.fontSize = `${size}px`; });
    return;
  }
  const target = $(".direct-value-v23", element) || element;
  target.style.fontFamily = font.css;
  target.style.fontSize = `${size}px`;
}

function applyAllTypography() {
  const paper = $("#directPaperV23");
  if (!paper) return;
  paper.querySelectorAll("[data-direct-key]").forEach(element => {
    const key = element.dataset.directKey || "";
    if (!key.startsWith("participant:")) applyTypography(key);
  });
  if (selectedKey) select(selectedKey);
  scheduleLegacyApply();
}

function ensureDisplayText(participant) {
  if (!displayNames || !ydoc) return null;
  let value = displayNames.get(participant.id);
  if (value instanceof Y.Text) return value;
  const text = new Y.Text(value == null ? String(participant.name || "Integrante") : String(value));
  ydoc.transact(() => displayNames.set(participant.id, text), "ucom-participant-display-v24");
  return text;
}

function diffText(ytext, before, after) {
  let prefix = 0;
  const common = Math.min(before.length, after.length);
  while (prefix < common && before[prefix] === after[prefix]) prefix++;
  let oldEnd = before.length, newEnd = after.length;
  while (oldEnd > prefix && newEnd > prefix && before[oldEnd - 1] === after[newEnd - 1]) { oldEnd--; newEnd--; }
  if (oldEnd > prefix) ytext.delete(prefix, oldEnd - prefix);
  if (newEnd > prefix) ytext.insert(prefix, after.slice(prefix, newEnd));
}

function bindDisplayLine(line, ytext) {
  if (line._v24Text === ytext) return;
  line._v24Unbind?.();
  line._v24Text = ytext;
  line.textContent = ytext.toString();
  const input = () => {
    if (finalized()) return;
    const before = ytext.toString();
    const after = line.innerText.replace(/\n+/g, " ").trimStart();
    if (before !== after) ydoc.transact(() => diffText(ytext, before, after), "ucom-participant-display-v24");
  };
  const remote = () => {
    if (document.activeElement === line) return;
    const next = ytext.toString();
    if (line.innerText !== next) line.textContent = next;
  };
  line.addEventListener("input", input);
  ytext.observe(remote);
  line._v24Unbind = () => { line.removeEventListener("input", input); try { ytext.unobserve(remote); } catch {} };
}

function groupDefaults() {
  const count = Math.max(1, participants().length);
  return { x: 506, y: 198, w: 230, h: Math.max(66, 31 + count * 22) };
}

function groupLayout() {
  const defaults = groupDefaults();
  const stored = styles?.get("meta:members");
  return stored && typeof stored === "object" ? { ...defaults, ...stored } : defaults;
}

function applyGroupBox(group) {
  const value = groupLayout();
  group.style.left = `${Math.round(value.x)}px`;
  group.style.top = `${Math.round(value.y)}px`;
  group.style.width = `${Math.round(value.w)}px`;
  group.style.minHeight = `${Math.round(value.h)}px`;
}

function pageScale() {
  const paper = $("#directPaperV23");
  return paper ? (paper.getBoundingClientRect().width / 794 || 1) : 1;
}

function installGroupControls(group) {
  let drag = $(":scope > .participants-drag-v24", group);
  if (!drag) {
    drag = document.createElement("button");
    drag.type = "button"; drag.className = "direct-drag-v23 participants-drag-v24"; drag.textContent = "⋮⋮"; drag.title = "Mover integrantes";
    group.prepend(drag);
    drag.addEventListener("pointerdown", event => beginGroupDrag(event, group));
  }
  let resize = $(":scope > .participants-resize-v24", group);
  if (!resize) {
    resize = document.createElement("span");
    resize.className = "direct-resize-v23 participants-resize-v24"; resize.title = "Cambiar tamaño";
    group.appendChild(resize);
    resize.addEventListener("pointerdown", event => beginGroupResize(event, group));
  }
  drag.disabled = finalized();
  resize.classList.toggle("hidden", finalized());
}

function beginGroupDrag(event, group) {
  if (finalized()) return;
  event.preventDefault(); event.stopPropagation(); select("meta:members");
  const start = groupLayout(), scale = pageScale(), sx = event.clientX, sy = event.clientY;
  const move = e => {
    const x = Math.max(0, Math.min(754, start.x + (e.clientX - sx) / scale));
    const y = Math.max(0, Math.min(1093, start.y + (e.clientY - sy) / scale));
    group.style.left = `${Math.round(x / 4) * 4}px`; group.style.top = `${Math.round(y / 4) * 4}px`;
  };
  const end = e => {
    window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerup", end, true);
    patchStyle("meta:members", { x: Math.max(0, Math.min(754, Math.round((start.x + (e.clientX - sx) / scale) / 4) * 4)), y: Math.max(0, Math.min(1093, Math.round((start.y + (e.clientY - sy) / scale) / 4) * 4)) });
  };
  window.addEventListener("pointermove", move, true); window.addEventListener("pointerup", end, true);
}

function beginGroupResize(event, group) {
  if (finalized()) return;
  event.preventDefault(); event.stopPropagation(); select("meta:members");
  const start = groupLayout(), scale = pageScale(), sx = event.clientX, sy = event.clientY;
  const move = e => {
    const w = Math.max(130, Math.min(794 - start.x, start.w + (e.clientX - sx) / scale));
    const h = Math.max(54, Math.min(1123 - start.y, start.h + (e.clientY - sy) / scale));
    group.style.width = `${Math.round(w / 4) * 4}px`; group.style.minHeight = `${Math.round(h / 4) * 4}px`;
  };
  const end = e => {
    window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerup", end, true);
    patchStyle("meta:members", { w: Math.round(Math.max(130, Math.min(794 - start.x, start.w + (e.clientX - sx) / scale)) / 4) * 4, h: Math.round(Math.max(54, Math.min(1123 - start.y, start.h + (e.clientY - sy) / scale)) / 4) * 4 });
  };
  window.addEventListener("pointermove", move, true); window.addEventListener("pointerup", end, true);
}

function renderParticipantsGroup() {
  const layer = $("#directLayerV23");
  if (!layer || !displayNames) return;
  const show = $("#showMembersV13") ? $("#showMembersV13").checked : true;
  let group = $("#participantsGroupV24", layer);
  if (!group) {
    group = document.createElement("section");
    group.id = "participantsGroupV24";
    group.dataset.directKey = "meta:members";
    group.className = "direct-item-v23 direct-participants-group-v24";
    group.innerHTML = '<span class="direct-label-v23 participants-label-v24">Integrantes</span><div class="participant-display-list-v24"></div>';
    group.addEventListener("pointerdown", event => { if (!event.target.closest(".direct-drag-v23,.direct-resize-v23")) select("meta:members"); });
    layer.appendChild(group);
  }
  group.classList.toggle("hidden", !show);
  group.classList.toggle("selected", selectedKey === "meta:members");
  applyGroupBox(group);
  installGroupControls(group);
  const list = $(".participant-display-list-v24", group);
  const current = participants();
  const wanted = new Set(current.map(item => item.id));
  list.querySelectorAll("[data-participant-id]").forEach(line => { if (!wanted.has(line.dataset.participantId)) { line._v24Unbind?.(); line.remove(); } });
  current.forEach(participant => {
    let line = list.querySelector(`[data-participant-id="${CSS.escape(participant.id)}"]`);
    if (!line) {
      line = document.createElement("div"); line.className = "participant-display-name-v24"; line.dataset.participantId = participant.id;
      line.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); line.blur(); } });
      list.appendChild(line);
    }
    line.contentEditable = finalized() ? "false" : "true";
    line.spellcheck = false;
    line.title = "Nombre mostrado en el documento";
    bindDisplayLine(line, ensureDisplayText(participant));
    list.appendChild(line);
  });
  applyTypography("meta:members");
  scheduleLegacyApply();
}

function renderFromParticipants() {
  const signature = participants().map(item => `${item.id}:${item.name}`).join("|");
  if (signature === participantSignature && $("#participantsGroupV24")) return;
  participantSignature = signature;
  renderParticipantsGroup();
}

function applyLegacyPresentation() {
  const root = $("#previewPaper");
  if (!root || !styles) return;
  const titleStyle = styleValue("meta:title"), docTitle = $(".doc-title", root);
  if (docTitle) { docTitle.style.fontFamily = (FONTS[titleStyle.fontFamily] || FONTS.system).css; docTitle.style.fontSize = `${titleStyle.fontSize}px`; }
  root.querySelectorAll(".doc-meta > div").forEach(row => {
    const label = (row.querySelector("span")?.textContent || "").trim().toLowerCase();
    if (!label.startsWith("integrante")) return;
    const strong = row.querySelector("strong"); if (!strong) return;
    const value = styleValue("meta:members");
    strong.style.fontFamily = (FONTS[value.fontFamily] || FONTS.system).css; strong.style.fontSize = `${value.fontSize}px`;
    const names = participants().map(participant => { const text = displayNames.get(participant.id); return text instanceof Y.Text ? text.toString() : String(participant.name || "Integrante"); });
    strong.replaceChildren(...names.map(name => { const line = document.createElement("span"); line.textContent = name; line.style.display = "block"; return line; }));
  });
  const blocks = window.UCOMDirectCanvasV23?.getState?.().blocks || [];
  root.querySelectorAll(".doc-blocks-v15 > .doc-block-v15").forEach((section, index) => {
    const block = blocks[index]; if (!block) return;
    const value = styleValue(`block:${block.id}`), font = FONTS[value.fontFamily] || FONTS.system, size = Number(value.fontSize) || 11;
    section.style.fontFamily = font.css;
    const body = $(".doc-block-body-v15", section), title = $("h3", section), label = $(".doc-block-label-v15", section);
    if (body) { body.style.fontFamily = font.css; body.style.fontSize = `${size}px`; }
    if (title) { title.style.fontFamily = font.css; title.style.fontSize = `${Math.max(10,size+3)}px`; }
    if (label) { label.style.fontFamily = font.css; label.style.fontSize = `${Math.max(7,Math.round(size*.72))}px`; }
  });
}

function scheduleLegacyApply() { clearTimeout(legacyTimer); legacyTimer = setTimeout(applyLegacyPresentation, 45); }
function observeLegacy() {
  legacyObserver?.disconnect();
  const root = $("#previewPaper"); if (!root) return;
  legacyObserver = new MutationObserver(() => scheduleLegacyApply());
  legacyObserver.observe(root, { childList: true, subtree: true });
}

function bindPaperSelection() {
  const paper = $("#directPaperV23");
  if (!paper || paper.dataset.typographyBoundV24 === "1") return;
  paper.dataset.typographyBoundV24 = "1";
  paper.addEventListener("pointerdown", event => {
    const item = event.target.closest("[data-direct-key]");
    if (!item || item.classList.contains("direct-participant-v23")) return;
    select(item.dataset.directKey || "");
  }, true);
}

function renderAll() {
  ensureToolbar(); bindPaperSelection(); renderParticipantsGroup(); applyAllTypography(); applyLegacyPresentation();
}

function connect(id) {
  destroy();
  const auth = token(id); if (!id || !auth) return;
  project = id;
  ydoc = new Y.Doc(); styles = ydoc.getMap("layout-v23"); displayNames = ydoc.getMap("participant-display-v24");
  provider = new WebsocketProvider(WS, id, ydoc, { params: { token: auth } });
  provider.awareness.setLocalState(null);
  provider.on("sync", synced => { if (synced) renderAll(); });
  styles.observeDeep(() => renderAll());
  displayNames.observeDeep(() => { renderParticipantsGroup(); scheduleLegacyApply(); });
  participantTimer = setInterval(renderFromParticipants, 900);
  observeLegacy();
  setTimeout(renderAll, 500);
}

function destroy() {
  clearInterval(participantTimer); clearTimeout(legacyTimer);
  legacyObserver?.disconnect(); legacyObserver = null;
  document.querySelectorAll(".participant-display-name-v24").forEach(line => line._v24Unbind?.());
  try { provider?.awareness.setLocalState(null); } catch {}
  try { provider?.destroy(); } catch {}
  try { ydoc?.destroy(); } catch {}
  provider = null; ydoc = null; styles = null; displayNames = null; project = ""; selectedKey = ""; participantSignature = "";
  $("#typographyV24")?.remove(); $("#participantsGroupV24")?.remove();
}

function route() {
  const id = projectId();
  if (!id) { if (project) destroy(); return; }
  if (id === project && provider) return;
  setTimeout(() => connect(id), 1050);
}

function init() {
  window.addEventListener("hashchange", route);
  window.addEventListener("ucom:lifecycle-v18", () => setTimeout(renderAll, 30));
  setTimeout(route, 1100);
}

window.UCOMPaperStyleV24 = { select, render: renderAll, getState: () => ({ project, selectedKey }) };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
