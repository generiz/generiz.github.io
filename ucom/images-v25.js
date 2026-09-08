import * as Y from "https://cdn.jsdelivr.net/npm/yjs@13.6.32/+esm";
import { WebsocketProvider } from "https://cdn.jsdelivr.net/npm/y-websocket@3.1.0/+esm";

const API = "https://ucom-api.ufotech.com.py";
const WS = "wss://ucom-api.ufotech.com.py/ws";
const ADMIN_KEY = "ucom.admin.session.v2";
const GOOGLE_KEY = "ucom.google.session.v11";
const MAX_BYTES = 8 * 1024 * 1024;
const $ = (selector, root = document) => root.querySelector(selector);

let currentProject = "";
let ydoc = null;
let yImages = null;
let provider = null;
let selectedId = "";
let imageCache = new Map();
let renderTimer = 0;
let routeTimer = 0;

const projectId = () => {
  const match = location.hash.match(/^#\/p\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : "";
};
const token = id => sessionStorage.getItem(ADMIN_KEY) || sessionStorage.getItem(`ucom.participant.${id}`) || localStorage.getItem(GOOGLE_KEY) || "";
const finalized = () => $("#workspace")?.classList.contains("task-finalized-v18") || false;

function toast(message, error = false) {
  const box = $("#toast");
  if (!box) return;
  box.textContent = message;
  box.className = `toast show ${error ? "error" : ""}`;
  setTimeout(() => { if (box.textContent === message) box.className = "toast"; }, 3200);
}

function ensureText(record, key, fallback = "") {
  let value = record.get(key);
  if (value instanceof Y.Text) return value;
  const text = new Y.Text(value == null ? fallback : String(value));
  ydoc?.transact(() => record.set(key, text), "ucom-image-normalize-v25");
  return text;
}

function diffText(ytext, before, after) {
  let prefix = 0;
  const common = Math.min(before.length, after.length);
  while (prefix < common && before[prefix] === after[prefix]) prefix++;
  let oldEnd = before.length;
  let newEnd = after.length;
  while (oldEnd > prefix && newEnd > prefix && before[oldEnd - 1] === after[newEnd - 1]) { oldEnd--; newEnd--; }
  if (oldEnd > prefix) ytext.delete(prefix, oldEnd - prefix);
  if (newEnd > prefix) ytext.insert(prefix, after.slice(prefix, newEnd));
}

function records() {
  if (!yImages) return [];
  return [...yImages.entries()]
    .filter(([, value]) => value instanceof Y.Map)
    .sort((a, b) => Number(a[1].get("created") || 0) - Number(b[1].get("created") || 0));
}

function number(record, key, fallback) {
  const value = Number(record.get(key));
  return Number.isFinite(value) ? value : fallback;
}

function patchRecord(record, patch) {
  if (!ydoc || !record || finalized()) return;
  ydoc.transact(() => Object.entries(patch).forEach(([key, value]) => record.set(key, value)), "ucom-image-v25");
}

function ensureUI() {
  const host = $("#canvasToolsV23");
  const paper = $("#directPaperV23");
  if (!host || !paper) return false;

  if (!$("#imageAddWrapV25")) {
    const wrap = document.createElement("div");
    wrap.id = "imageAddWrapV25";
    wrap.className = "image-add-wrap-v25";
    wrap.innerHTML = '<button id="imageAddV25" class="ghost" type="button">+ Imagen</button><input id="imageInputV25" type="file" accept="image/jpeg,image/png,image/webp" hidden>';
    const add = $(".canvas-add-v23", host);
    if (add) add.after(wrap); else host.appendChild(wrap);
    $("#imageAddV25")?.addEventListener("click", () => { if (!finalized()) $("#imageInputV25")?.click(); });
    $("#imageInputV25")?.addEventListener("change", event => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) uploadImage(file).catch(error => toast(error.message || "No se pudo subir la imagen", true));
    });
  }

  if (!$("#imageToolsV25")) {
    const panel = document.createElement("div");
    panel.id = "imageToolsV25";
    panel.className = "image-tools-v25 hidden";
    panel.innerHTML = `
      <span class="image-tools-title-v25">Imagen</span>
      <div class="image-tools-grid-v25">
        <label>Ajuste<select id="imageFitV25"><option value="contain">Ajustar</option><option value="cover">Recortar</option></select></label>
        <label>Esquinas<select id="imageRadiusV25"><option value="0">Rectas</option><option value="8">8 px</option><option value="16">16 px</option><option value="28">28 px</option></select></label>
        <label>Opacidad<select id="imageOpacityV25"><option value="1">100%</option><option value="0.85">85%</option><option value="0.7">70%</option><option value="0.5">50%</option></select></label>
        <label class="image-caption-toggle-v25"><input id="imageCaptionToggleV25" type="checkbox" checked> Pie de imagen</label>
      </div>
      <button id="imageDeleteV25" class="ghost danger" type="button">Eliminar imagen</button>`;
    host.appendChild(panel);
    $("#imageFitV25")?.addEventListener("change", event => updateSelected({ fit: event.target.value }));
    $("#imageRadiusV25")?.addEventListener("change", event => updateSelected({ radius: Number(event.target.value) || 0 }));
    $("#imageOpacityV25")?.addEventListener("change", event => updateSelected({ opacity: Number(event.target.value) || 1 }));
    $("#imageCaptionToggleV25")?.addEventListener("change", event => updateSelected({ showCaption: !!event.target.checked }));
    $("#imageDeleteV25")?.addEventListener("click", deleteSelected);
  }

  if (paper.dataset.imagesV25Bound !== "1") {
    paper.dataset.imagesV25Bound = "1";
    paper.addEventListener("dragover", event => {
      if (finalized() || !event.dataTransfer?.types?.includes("Files")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      paper.classList.add("image-drop-v25");
    });
    paper.addEventListener("dragleave", () => paper.classList.remove("image-drop-v25"));
    paper.addEventListener("drop", event => {
      paper.classList.remove("image-drop-v25");
      if (finalized()) return;
      const file = [...(event.dataTransfer?.files || [])].find(item => item.type.startsWith("image/"));
      if (!file) return;
      event.preventDefault();
      uploadImage(file, pointFromEvent(event)).catch(error => toast(error.message || "No se pudo subir la imagen", true));
    });
  }

  const addButton = $("#imageAddV25");
  if (addButton) addButton.disabled = finalized();
  return true;
}

function pointFromEvent(event) {
  const paper = $("#directPaperV23");
  if (!paper) return null;
  const rect = paper.getBoundingClientRect();
  const scale = rect.width / 794 || 1;
  return {
    x: Math.max(0, Math.min(754, (event.clientX - rect.left) / scale)),
    y: Math.max(0, Math.min(1080, (event.clientY - rect.top) / scale)),
  };
}

function imageDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve({ width: image.naturalWidth || 800, height: image.naturalHeight || 600 }); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen")); };
    image.src = url;
  });
}

async function uploadImage(file, point = null) {
  const id = projectId();
  const auth = token(id);
  if (!id || !auth || !yImages) throw new Error("Abrí una tarea antes de subir imágenes");
  if (finalized()) throw new Error("La tarea está finalizada");
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type || "")) throw new Error("Usá JPG, PNG o WEBP");
  if (file.size > MAX_BYTES) throw new Error("La imagen supera 8 MB");

  const button = $("#imageAddV25");
  const previous = button?.textContent || "+ Imagen";
  if (button) { button.disabled = true; button.textContent = "Subiendo…"; }
  try {
    const dimensions = await imageDimensions(file);
    const form = new FormData();
    form.append("file", file, file.name || "imagen");
    const response = await fetch(`${API}/api/projects/${encodeURIComponent(id)}/images-v25`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth}` },
      body: form,
    });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    const fileId = data.image?.file_id;
    if (!fileId) throw new Error("El servidor no devolvió la imagen");

    const imageId = crypto.randomUUID ? crypto.randomUUID() : `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const naturalW = Math.max(1, dimensions.width);
    const naturalH = Math.max(1, dimensions.height);
    const ratio = naturalW / naturalH;
    let w = Math.min(360, Math.max(180, naturalW));
    let h = w / ratio + 28;
    if (h > 360) { h = 360; w = Math.max(140, (h - 28) * ratio); }
    const x = point ? Math.max(0, Math.min(794 - w, point.x - w / 2)) : Math.max(48, (794 - w) / 2);
    const y = point ? Math.max(24, Math.min(1123 - h - 30, point.y - 20)) : 330;

    const record = new Y.Map();
    record.set("id", imageId);
    record.set("fileId", fileId);
    record.set("x", Math.round(x));
    record.set("y", Math.round(y));
    record.set("w", Math.round(w));
    record.set("h", Math.round(h));
    record.set("naturalW", naturalW);
    record.set("naturalH", naturalH);
    record.set("fit", "contain");
    record.set("radius", 8);
    record.set("opacity", 1);
    record.set("showCaption", true);
    record.set("created", Date.now());
    record.set("caption", new Y.Text(""));
    ydoc.transact(() => yImages.set(imageId, record), "ucom-image-v25");
    selectedId = imageId;
    scheduleRender();
    toast("Imagen agregada");
  } finally {
    if (button) { button.disabled = finalized(); button.textContent = previous; }
  }
}

function selectedRecord() {
  const value = selectedId && yImages?.get(selectedId);
  return value instanceof Y.Map ? value : null;
}

function updateSelected(patch) {
  const record = selectedRecord();
  if (!record || finalized()) return;
  patchRecord(record, patch);
}

function renderTools() {
  const panel = $("#imageToolsV25");
  if (!panel) return;
  const record = selectedRecord();
  panel.classList.toggle("hidden", !record);
  if (!record) return;
  $("#typographyV24")?.classList.add("hidden");
  if ($("#imageFitV25")) $("#imageFitV25").value = String(record.get("fit") || "contain");
  if ($("#imageRadiusV25")) $("#imageRadiusV25").value = String(number(record, "radius", 8));
  if ($("#imageOpacityV25")) $("#imageOpacityV25").value = String(number(record, "opacity", 1));
  if ($("#imageCaptionToggleV25")) $("#imageCaptionToggleV25").checked = record.get("showCaption") !== false;
  if ($("#imageDeleteV25")) $("#imageDeleteV25").disabled = finalized();
}

async function deleteSelected() {
  const id = projectId();
  const auth = token(id);
  const record = selectedRecord();
  if (!record || !id || !auth || finalized()) return;
  if (!confirm("¿Eliminar esta imagen del documento?")) return;
  const fileId = String(record.get("fileId") || "");
  const imageId = selectedId;
  ydoc.transact(() => yImages.delete(imageId), "ucom-image-v25");
  selectedId = "";
  scheduleRender();
  if (fileId) {
    fetch(`${API}/api/projects/${encodeURIComponent(id)}/images-v25/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${auth}` },
    }).catch(() => {});
  }
}

function loadDataUrl(fileId) {
  const id = projectId();
  const auth = token(id);
  if (!id || !auth || !fileId) return Promise.reject(new Error("Imagen inválida"));
  if (imageCache.has(fileId)) return imageCache.get(fileId);
  const promise = fetch(`${API}/api/projects/${encodeURIComponent(id)}/images-v25/${encodeURIComponent(fileId)}`, {
    headers: { Authorization: `Bearer ${auth}` },
  }).then(async response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("No se pudo abrir la imagen"));
      reader.readAsDataURL(blob);
    });
  });
  imageCache.set(fileId, promise);
  promise.catch(() => imageCache.delete(fileId));
  return promise;
}

function bindCaption(element, ytext) {
  if (element._imageTextV25 === ytext) return;
  element._imageUnbindV25?.();
  element._imageTextV25 = ytext;
  element.textContent = ytext.toString();
  const local = () => {
    if (finalized()) return;
    const before = ytext.toString();
    const after = element.innerText.replace(/\r/g, "");
    if (before !== after) ydoc.transact(() => diffText(ytext, before, after), "ucom-image-caption-v25");
  };
  const remote = () => {
    if (document.activeElement === element) return;
    const next = ytext.toString();
    if (element.innerText !== next) element.textContent = next;
  };
  element.addEventListener("input", local);
  ytext.observe(remote);
  element._imageUnbindV25 = () => { element.removeEventListener("input", local); try { ytext.unobserve(remote); } catch {} };
}

function createImageElement(imageId) {
  const element = document.createElement("section");
  element.className = "direct-item-v23 direct-image-v25";
  element.dataset.imageId = imageId;
  element.dataset.directKey = `image:${imageId}`;
  element.innerHTML = `
    <button type="button" class="direct-drag-v23 image-drag-v25" title="Mover">⋮⋮</button>
    <div class="image-frame-v25"><img class="image-content-v25" draggable="false" alt=""></div>
    <div class="image-caption-v25" data-placeholder="Pie de imagen"></div>
    <span class="direct-resize-v23 image-resize-v25" title="Cambiar tamaño"></span>`;
  element.addEventListener("pointerdown", event => {
    if (event.target.closest(".image-drag-v25,.image-resize-v25")) return;
    selectedId = imageId;
    renderSelection();
  });
  $(".image-drag-v25", element)?.addEventListener("pointerdown", event => beginDrag(event, imageId, element));
  $(".image-resize-v25", element)?.addEventListener("pointerdown", event => beginResize(event, imageId, element));
  return element;
}

function renderImages() {
  if (!ensureUI()) return;
  const layer = $("#directLayerV23");
  if (!layer || !yImages) return;
  const entries = records();
  const wanted = new Set(entries.map(([id]) => id));
  layer.querySelectorAll(".direct-image-v25[data-image-id]").forEach(element => {
    if (!wanted.has(element.dataset.imageId)) { element.querySelector(".image-caption-v25")?._imageUnbindV25?.(); element.remove(); }
  });

  entries.forEach(([imageId, record]) => {
    let element = layer.querySelector(`.direct-image-v25[data-image-id="${CSS.escape(imageId)}"]`);
    if (!element) { element = createImageElement(imageId); layer.appendChild(element); }
    const x = number(record, "x", 200), y = number(record, "y", 300), w = Math.max(80, number(record, "w", 280)), h = Math.max(80, number(record, "h", 210));
    element.style.left = `${Math.round(x)}px`;
    element.style.top = `${Math.round(y)}px`;
    element.style.width = `${Math.round(w)}px`;
    element.style.height = `${Math.round(h)}px`;
    element.style.opacity = String(Math.max(.1, Math.min(1, number(record, "opacity", 1))));
    element.classList.toggle("selected", selectedId === imageId);
    element.classList.toggle("no-caption-v25", record.get("showCaption") === false);
    const image = $(".image-content-v25", element);
    image.style.objectFit = String(record.get("fit") || "contain") === "cover" ? "cover" : "contain";
    image.style.borderRadius = `${Math.max(0, Math.min(80, number(record, "radius", 8)))}px`;
    const caption = $(".image-caption-v25", element);
    caption.contentEditable = finalized() ? "false" : "true";
    caption.spellcheck = true;
    bindCaption(caption, ensureText(record, "caption", ""));
    const fileId = String(record.get("fileId") || "");
    if (fileId && image.dataset.fileId !== fileId) {
      image.dataset.fileId = fileId;
      image.classList.add("loading");
      loadDataUrl(fileId).then(url => { if (image.dataset.fileId === fileId) { image.src = url; image.classList.remove("loading"); syncLegacyImages(); } }).catch(() => { image.classList.remove("loading"); image.classList.add("broken"); });
    }
    $(".image-drag-v25", element).disabled = finalized();
    $(".image-resize-v25", element).classList.toggle("hidden", finalized());
  });
  renderTools();
  syncLegacyImages();
}

function renderSelection() {
  document.querySelectorAll("#directPaperV23 .direct-image-v25").forEach(element => element.classList.toggle("selected", element.dataset.imageId === selectedId));
  renderTools();
}

function pageScale() {
  const paper = $("#directPaperV23");
  return paper ? (paper.getBoundingClientRect().width / 794 || 1) : 1;
}

function beginDrag(event, imageId, element) {
  if (finalized()) return;
  const record = yImages?.get(imageId);
  if (!(record instanceof Y.Map)) return;
  event.preventDefault(); event.stopPropagation();
  selectedId = imageId; renderSelection();
  const startX = number(record, "x", 0), startY = number(record, "y", 0), scale = pageScale(), sx = event.clientX, sy = event.clientY;
  let lastSent = 0;
  const move = moveEvent => {
    const x = Math.max(0, Math.min(714, startX + (moveEvent.clientX - sx) / scale));
    const y = Math.max(0, Math.min(1083, startY + (moveEvent.clientY - sy) / scale));
    element.style.left = `${Math.round(x)}px`; element.style.top = `${Math.round(y)}px`;
    const now = performance.now();
    if (now - lastSent > 50) { lastSent = now; patchRecord(record, { x: Math.round(x), y: Math.round(y) }); }
  };
  const end = endEvent => {
    window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerup", end, true); window.removeEventListener("pointercancel", end, true);
    const x = Math.max(0, Math.min(714, startX + (endEvent.clientX - sx) / scale));
    const y = Math.max(0, Math.min(1083, startY + (endEvent.clientY - sy) / scale));
    patchRecord(record, { x: Math.round(x), y: Math.round(y) });
  };
  window.addEventListener("pointermove", move, true); window.addEventListener("pointerup", end, true); window.addEventListener("pointercancel", end, true);
}

function beginResize(event, imageId, element) {
  if (finalized()) return;
  const record = yImages?.get(imageId);
  if (!(record instanceof Y.Map)) return;
  event.preventDefault(); event.stopPropagation();
  selectedId = imageId; renderSelection();
  const x = number(record, "x", 0), y = number(record, "y", 0), startW = number(record, "w", 280), startH = number(record, "h", 210);
  const naturalW = Math.max(1, number(record, "naturalW", startW)), naturalH = Math.max(1, number(record, "naturalH", Math.max(1, startH - 28)));
  const ratio = naturalW / naturalH;
  const captionSpace = record.get("showCaption") === false ? 0 : 28;
  const scale = pageScale(), sx = event.clientX, sy = event.clientY;
  let lastSent = 0;
  const dimensions = resizeEvent => {
    let w = Math.max(90, Math.min(794 - x, startW + (resizeEvent.clientX - sx) / scale));
    let h = Math.max(80, Math.min(1123 - y, startH + (resizeEvent.clientY - sy) / scale));
    if (!resizeEvent.shiftKey) {
      const byWidth = Math.max(80, w / ratio + captionSpace);
      const byHeight = Math.max(90, (h - captionSpace) * ratio);
      if (Math.abs(w - startW) >= Math.abs(h - startH)) h = Math.min(1123 - y, byWidth);
      else w = Math.min(794 - x, byHeight);
    }
    return { w: Math.round(w), h: Math.round(h) };
  };
  const move = moveEvent => {
    const next = dimensions(moveEvent);
    element.style.width = `${next.w}px`; element.style.height = `${next.h}px`;
    const now = performance.now();
    if (now - lastSent > 50) { lastSent = now; patchRecord(record, next); }
  };
  const end = endEvent => {
    window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerup", end, true); window.removeEventListener("pointercancel", end, true);
    patchRecord(record, dimensions(endEvent));
  };
  window.addEventListener("pointermove", move, true); window.addEventListener("pointerup", end, true); window.addEventListener("pointercancel", end, true);
}

function syncLegacyImages() {
  const root = $("#previewPaper");
  if (!root || !yImages) return;
  root.style.position = "relative";
  root.querySelector(".doc-images-v25")?.remove();
  const layer = document.createElement("div");
  layer.className = "doc-images-v25";
  layer.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:6;";
  records().forEach(([imageId, record]) => {
    const fileId = String(record.get("fileId") || "");
    const cached = imageCache.get(fileId);
    if (!cached) { if (fileId) loadDataUrl(fileId).then(() => syncLegacyImages()).catch(() => {}); return; }
    Promise.resolve(cached).then(url => {
      if (!layer.isConnected) return;
      const figure = document.createElement("figure");
      const showCaption = record.get("showCaption") !== false;
      figure.style.cssText = `position:absolute;box-sizing:border-box;margin:0;left:${number(record,"x",200)}px;top:${number(record,"y",300)}px;width:${number(record,"w",280)}px;height:${number(record,"h",210)}px;opacity:${number(record,"opacity",1)};`;
      const img = document.createElement("img");
      img.src = url;
      img.alt = ensureText(record, "caption", "").toString() || "Imagen";
      img.style.cssText = `display:block;width:100%;height:${showCaption ? "calc(100% - 26px)" : "100%"};object-fit:${String(record.get("fit")||"contain")==="cover"?"cover":"contain"};border-radius:${number(record,"radius",8)}px;margin:0;`;
      figure.appendChild(img);
      if (showCaption) {
        const caption = document.createElement("figcaption");
        caption.textContent = ensureText(record, "caption", "").toString();
        caption.style.cssText = "height:26px;padding-top:5px;font:10px/1.3 Arial,sans-serif;color:#58636d;overflow:hidden;";
        figure.appendChild(caption);
      }
      layer.appendChild(figure);
    }).catch(() => {});
  });
  root.appendChild(layer);
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderImages, 20);
}

async function connect(id) {
  destroy();
  const auth = token(id);
  if (!id || !auth) return;
  currentProject = id;
  for (let attempt = 0; attempt < 20 && !ensureUI(); attempt++) await new Promise(resolve => setTimeout(resolve, 120));
  if (!ensureUI()) return;
  ydoc = new Y.Doc();
  yImages = ydoc.getMap("images-v25");
  provider = new WebsocketProvider(WS, id, ydoc, { params: { token: auth } });
  provider.awareness.setLocalState(null);
  provider.on("sync", synced => { if (synced) renderImages(); });
  yImages.observeDeep(scheduleRender);
  renderImages();
}

function destroy() {
  clearTimeout(renderTimer);
  try { yImages?.unobserveDeep(scheduleRender); } catch {}
  try { provider?.destroy(); } catch {}
  try { ydoc?.destroy(); } catch {}
  provider = null; ydoc = null; yImages = null; currentProject = ""; selectedId = "";
  imageCache.clear();
  $("#imageAddWrapV25")?.remove();
  $("#imageToolsV25")?.remove();
  document.querySelectorAll(".direct-image-v25").forEach(element => element.remove());
  $("#previewPaper .doc-images-v25")?.remove();
}

function routeSync() {
  clearTimeout(routeTimer);
  routeTimer = setTimeout(() => {
    const id = projectId();
    if (!id) { if (currentProject) destroy(); return; }
    if (id === currentProject && provider) { ensureUI(); return; }
    connect(id);
  }, 500);
}

function pasteImage(event) {
  if (!projectId() || finalized()) return;
  const file = [...(event.clipboardData?.files || [])].find(item => item.type.startsWith("image/"));
  if (!file) return;
  event.preventDefault();
  uploadImage(file).catch(error => toast(error.message || "No se pudo pegar la imagen", true));
}

function init() {
  window.addEventListener("hashchange", routeSync);
  window.addEventListener("paste", pasteImage);
  window.addEventListener("ucom:lifecycle-v18", () => { ensureUI(); renderImages(); });
  setTimeout(routeSync, 1000);
}

window.UCOMImagesV25 = {
  upload: uploadImage,
  getState: () => ({ projectId: currentProject, selectedId, images: records().map(([id, record]) => ({ id, fileId: record.get("fileId"), x: record.get("x"), y: record.get("y"), w: record.get("w"), h: record.get("h") })) }),
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
