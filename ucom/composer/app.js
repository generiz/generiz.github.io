import { GridStack } from "https://cdn.jsdelivr.net/npm/gridstack@12.3.3/+esm";
import * as Y from "https://cdn.jsdelivr.net/npm/yjs@13.6.32/+esm";
import { WebsocketProvider } from "https://cdn.jsdelivr.net/npm/y-websocket@3.1.0/+esm";

const API = "https://ucom-api.ufotech.com.py";
const WS = "wss://ucom-api.ufotech.com.py/ws";
const ADMIN_KEY = "ucom.admin.session.v2";
const GOOGLE_KEY = "ucom.google.session.v11";
const CELL_H = 36;
const GRID_W = 710;
const PAGE_W = 794;
const PAGE_H = 1123;
const PAGE_X = 42;
const PAGE_Y = 38;
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const TYPES = {
  title: { label: "Título", icon: "T", hint: "Título principal" },
  heading: { label: "Sección", icon: "H", hint: "Encabezado de sección" },
  paragraph: { label: "Texto", icon: "¶", hint: "Párrafo o desarrollo" },
  callout: { label: "Destacado", icon: "!", hint: "Idea o advertencia" },
  card: { label: "Tarjeta", icon: "▣", hint: "Contenido agrupado" },
  table: { label: "Tabla", icon: "▦", hint: "Matriz o comparación" },
  process: { label: "Proceso", icon: "→", hint: "Flujo por etapas" },
  kpis: { label: "Indicadores", icon: "#", hint: "KPIs y cifras" },
  image: { label: "Imagen", icon: "▧", hint: "Evidencia visual" },
  members: { label: "Integrantes", icon: "◎", hint: "Lista del equipo" },
  meta: { label: "Datos", icon: "≡", hint: "Materia, profesor, etc." },
  quote: { label: "Cita", icon: "“", hint: "Frase principal" },
  divider: { label: "Separador", icon: "—", hint: "Línea visual" },
};

const VARIANTS = {
  title: [["default","Principal"],["cover","Portada"],["compact","Compacto"]],
  heading: [["default","Normal"],["sectionbar","Barra de sección"]],
  paragraph: [["default","Normal"],["lead","Destacado"],["small","Compacto"],["two-column","Dos columnas"]],
  callout: [["default","Acento"],["dark","Oscuro"],["soft-orange","Naranja suave"],["soft-red","Rojo suave"]],
  card: [["default","Blanca"],["soft","Suave"],["dark","Oscura"],["accent-top","Acento superior"]],
  table: [["default","Encabezado oscuro"],["light","Encabezado claro"]],
  process: [["default","Tarjetas"],["line","Línea"]],
  kpis: [["default","Oscuros"],["light","Claros"]],
  image: [["default","Recortar"],["contain","Ajustar"]],
  members: [["default","Dos columnas"],["list","Lista"],["inline","En línea"]],
  meta: [["default","Encabezado"],["cover-brand","Portada"]],
  quote: [["default","Editorial"]],
  divider: [["default","Simple"],["accent","Acento"]],
};

const ACCENTS = {
  teal: "#007d8a", green: "#009b67", orange: "#f39a21", red: "#d83a52",
  blue: "#2c4c9b", purple: "#43358b", ink: "#071827"
};

let project = null;
let state = null;
let revision = 0;
let me = { name: "Integrante", role: "participant", email: "" };
let participants = [];
let presence = [];
let currentPageId = "";
let selectedComponentId = "";
let grid = null;
let rendering = false;
let readonly = false;
let ydoc = null;
let yTexts = null;
let provider = null;
let realtimeConnected = false;
let apiSaving = 0;
let opQueue = Promise.resolve();
let geometryTimer = 0;
let pollTimer = 0;
let presenceTimer = 0;
let heartbeatTimer = 0;
let selectedTab = "library";
let imageCache = new Map();
let localDirtyUntil = new Map();
let textObservers = new Map();
let composing = new WeakSet();
let lastStatusError = "";

const idFromHash = () => {
  const m = location.hash.match(/^#\/p\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : "";
};
const token = id => sessionStorage.getItem(ADMIN_KEY) || sessionStorage.getItem(`ucom.participant.${id}`) || localStorage.getItem(GOOGLE_KEY) || "";
const isAdmin = () => !!sessionStorage.getItem(ADMIN_KEY);
const clientId = (() => {
  const key = "ucom.composer.client.v31";
  let value = sessionStorage.getItem(key);
  if (!value) { value = crypto.randomUUID?.() || `client-${Date.now()}-${Math.random().toString(36).slice(2)}`; sessionStorage.setItem(key, value); }
  return value;
})();
const nowMs = () => Date.now();
const deepClone = value => JSON.parse(JSON.stringify(value));
const escapeHtml = value => String(value ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const uid = prefix => `${prefix}-${crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;

function toast(message, error = false) {
  const box = $("#toast");
  if (!box) return;
  box.textContent = message;
  box.className = `toast show${error ? " error" : ""}`;
  setTimeout(() => { if (box.textContent === message) box.className = "toast"; }, 3200);
}

async function request(method, path, body, options = {}) {
  const id = idFromHash();
  const auth = token(id);
  const init = { method, headers: { Accept: "application/json" }, signal: options.signal };
  if (auth) init.headers.Authorization = `Bearer ${auth}`;
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(body); }
  const response = await fetch(`${API}${path}`, init);
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) throw Object.assign(new Error(data.error || `HTTP ${response.status}`), { status: response.status, data });
  return data;
}

function currentPage() { return state?.pages?.find(page => page.id === currentPageId) || state?.pages?.[0] || null; }
function findComponent(componentId, page = currentPage()) { return page?.components?.find(component => component.id === componentId) || null; }
function componentPage(componentId) { return state?.pages?.find(page => page.components?.some(component => component.id === componentId)) || null; }
function pageIndex() { return Math.max(0, state?.pages?.findIndex(page => page.id === currentPageId) ?? 0); }

function markDirty(componentId, ms = 1800) {
  if (componentId) localDirtyUntil.set(componentId, nowMs() + ms);
}
function locallyDirty(componentId) { return Number(localDirtyUntil.get(componentId) || 0) > nowMs(); }

function setSaveState() {
  const badge = $("#saveBadge");
  if (!badge) return;
  if (lastStatusError) { badge.textContent = lastStatusError; badge.className = "save-badge error"; return; }
  if (apiSaving > 0) { badge.textContent = "Guardando…"; badge.className = "save-badge saving"; return; }
  badge.textContent = realtimeConnected ? "Guardado · en vivo" : "Guardado";
  badge.className = realtimeConnected ? "save-badge live" : "save-badge";
}

function queueOps(ops, { quiet = false } = {}) {
  if (readonly || !ops?.length) return Promise.resolve(null);
  apiSaving += 1; lastStatusError = ""; setSaveState();
  const id = idFromHash();
  opQueue = opQueue.then(async () => {
    try {
      const data = await request("POST", `/api/projects/${encodeURIComponent(id)}/composer-v31/ops`, { ops });
      revision = Math.max(revision, Number(data.revision || revision));
      lastStatusError = "";
      return data;
    } catch (error) {
      lastStatusError = "No se pudo guardar";
      if (!quiet) toast(error.message || "No se pudo guardar el cambio", true);
      throw error;
    } finally {
      apiSaving = Math.max(0, apiSaving - 1);
      setSaveState();
    }
  }).catch(() => null);
  return opQueue;
}

function patchComponent(componentId, patch, { dirty = true, quiet = true } = {}) {
  const page = componentPage(componentId);
  if (!page) return;
  const component = findComponent(componentId, page);
  if (!component) return;
  if (patch.props) component.props = { ...(component.props || {}), ...patch.props };
  for (const key of ["x","y","w","h","type","updated_ms"]) if (key in patch) component[key] = patch[key];
  if (dirty) markDirty(componentId);
  queueOps([{ op: "patch_component", page_id: page.id, component_id: componentId, patch }], { quiet });
}

function setDocumentTheme(theme) {
  if (!state || readonly || state.theme === theme) return;
  state.theme = theme;
  applyTheme();
  renderPageList();
  queueOps([{ op: "set_document", patch: { theme } }]);
}

function syncBackLink() {
  const id = idFromHash();
  $("#backLink").href = `../#/p/${encodeURIComponent(id)}`;
}

function applyTheme() {
  const paper = $("#paper");
  if (!paper || !state) return;
  [...paper.classList].filter(c => c.startsWith("theme-")).forEach(c => paper.classList.remove(c));
  paper.classList.add(`theme-${state.theme || "ucom-spectrum"}`);
  $("#themeSelect").value = state.theme || "ucom-spectrum";
}

function setReadonly(value) {
  readonly = !!value;
  const badge = $("#lifecycleBadge");
  badge.textContent = readonly ? "Finalizada" : "Abierta";
  badge.className = `state-badge${readonly ? " finalized" : ""}`;
  $("#addPageBtn").disabled = readonly;
  $("#templatePageBtn").disabled = readonly;
  $("#deletePageBtn").disabled = readonly;
  $("#duplicatePageBtn").disabled = readonly;
  if (grid) grid.enableMove(!readonly).enableResize(!readonly);
  $$("[contenteditable]", $("#paper")).forEach(el => el.contentEditable = readonly ? "false" : "true");
}

async function loadLifecycle() {
  try {
    const data = await request("GET", `/api/projects/${encodeURIComponent(idFromHash())}/lifecycle-v18`);
    setReadonly(!!data.finalized || data.status === "finalized");
  } catch { setReadonly(false); }
}

async function loadParticipants() {
  try {
    const data = await request("GET", `/api/projects/${encodeURIComponent(idFromHash())}/participants-v21`);
    participants = Array.isArray(data.participants) ? data.participants : [];
    if (data.me) me = data.me;
  } catch { participants = []; }
}

async function boot() {
  const id = idFromHash();
  if (!id) { location.replace("../"); return; }
  syncBackLink();
  if (!token(id)) { location.replace(`../#/p/${encodeURIComponent(id)}`); return; }
  try {
    const [composerData] = await Promise.all([
      request("GET", `/api/projects/${encodeURIComponent(id)}/composer-v31`),
      loadParticipants(), loadLifecycle()
    ]);
    project = composerData.project || {};
    state = composerData.state;
    revision = Number(composerData.revision || 0);
    if (composerData.me) me = composerData.me;
    currentPageId = state.pages?.[0]?.id || "";
    $("#taskTitle").textContent = project.title || "Documento";
    document.title = `${project.title || "Documento"} · UCOM Composer`;
    buildLibrary();
    buildTemplateDialog();
    bindUI();
    applyTheme();
    renderPageList();
    renderPage();
    initRealtime();
    startCollaborationLoops();
    setSaveState();
  } catch (error) {
    lastStatusError = "No se pudo abrir"; setSaveState();
    toast(error.message || "No se pudo abrir el Composer", true);
  }
}

function bindUI() {
  $$(".inspector-tab").forEach(tab => tab.addEventListener("click", () => selectInspectorTab(tab.dataset.tab)));
  $("#addPageBtn").addEventListener("click", openTemplateDialog);
  $("#templatePageBtn").addEventListener("click", openTemplateDialog);
  $("#closeTemplateDialog").addEventListener("click", () => $("#pageTemplateDialog").close());
  $("#duplicatePageBtn").addEventListener("click", duplicatePage);
  $("#deletePageBtn").addEventListener("click", deletePage);
  $("#themeSelect").addEventListener("change", e => setDocumentTheme(e.target.value));
  $("#pageNameInput").addEventListener("change", e => patchCurrentPage({ name: e.target.value.trim() || "Página" }));
  $("#pageBackgroundInput").addEventListener("change", e => patchCurrentPage({ background: e.target.value }));
  $("#componentTypeSelect").addEventListener("change", e => changeSelectedType(e.target.value));
  $("#componentWidth").addEventListener("change", e => resizeSelected(Number(e.target.value), null));
  $("#componentHeight").addEventListener("change", e => resizeSelected(null, Number(e.target.value)));
  $("#componentVariantSelect").addEventListener("change", e => patchSelectedProps({ variant: e.target.value }));
  $("#componentAccentSelect").addEventListener("change", e => patchSelectedProps({ accent: e.target.value }));
  $("#duplicateComponentBtn").addEventListener("click", duplicateSelectedComponent);
  $("#deleteComponentBtn").addEventListener("click", deleteSelectedComponent);
  $("#printBtn").addEventListener("click", printDocument);
  window.addEventListener("beforeunload", () => sendPresenceDelete());
  window.addEventListener("hashchange", () => location.reload());
}

function selectInspectorTab(tab) {
  selectedTab = tab === "style" ? "style" : "library";
  $$(".inspector-tab").forEach(el => el.classList.toggle("active", el.dataset.tab === selectedTab));
  $("#libraryPanel").classList.toggle("active", selectedTab === "library");
  $("#stylePanel").classList.toggle("active", selectedTab === "style");
}

function buildLibrary() {
  const host = $("#componentLibrary");
  host.replaceChildren(...Object.entries(TYPES).filter(([type]) => type !== "spacer").map(([type, meta]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "library-item";
    button.innerHTML = `<span>${escapeHtml(meta.icon)}</span><strong>${escapeHtml(meta.label)}</strong><small>${escapeHtml(meta.hint)}</small>`;
    button.addEventListener("click", () => addComponent(type));
    return button;
  }));
}

function defaultProps(type) {
  const names = participantNames();
  const defaults = {
    title: { eyebrow: project?.subject || "MATERIA", title: "Título", subtitle: "Subtítulo o bajada", variant: "default", accent: "teal" },
    heading: { label: "SECCIÓN", title: "Título de sección", variant: "default", accent: "teal" },
    paragraph: { text: "Escribí el contenido directamente sobre la página.", variant: "default", accent: "teal" },
    callout: { text: "Idea principal o información que merece destacarse.", variant: "default", accent: "teal" },
    card: { label: "CATEGORÍA", title: "Tarjeta", text: "Descripción breve.", variant: "default", accent: "teal" },
    table: { columns: ["Columna 1","Columna 2","Columna 3"], rows: [["Dato","Dato","Dato"],["Dato","Dato","Dato"]], variant: "default", accent: "teal" },
    process: { steps: [{title:"Paso 1",text:"Descripción"},{title:"Paso 2",text:"Descripción"},{title:"Paso 3",text:"Descripción"}], variant: "default", accent: "teal" },
    kpis: { kpis: [{value:"100%",label:"Indicador"},{value:"24 h",label:"Tiempo"},{value:"6",label:"Unidades"},{value:"1",label:"Resultado"}], variant: "default", accent: "teal" },
    image: { caption: "", image_file_id: "", variant: "default", accent: "teal" },
    members: { label: names.length === 1 ? "Integrante" : "Integrantes", members: names.length ? names : ["Nombre y apellido"], variant: "default", accent: "teal" },
    meta: { eyebrow: project?.subject || "MATERIA", title: project?.title || "Título", subtitle: project?.professor ? `Profesor/a · ${project.professor}` : "", variant: "default", accent: "teal" },
    quote: { text: "Una idea fuerte puede ocupar su propio espacio.", variant: "default", accent: "teal" },
    divider: { variant: "default", accent: "teal" },
  };
  return defaults[type] || defaults.paragraph;
}

function defaultGeometry(type) {
  return {
    title: [0,0,12,4], heading:[0,0,12,3], paragraph:[0,0,12,5], callout:[0,0,12,3],
    card:[0,0,6,4], table:[0,0,12,6], process:[0,0,12,5], kpis:[0,0,12,4], image:[0,0,6,7],
    members:[0,0,6,4], meta:[0,0,12,3], quote:[0,0,12,3], divider:[0,0,12,1]
  }[type] || [0,0,12,4];
}

function nextY(page = currentPage()) {
  return Math.min(38, Math.max(0, ...(page?.components || []).map(c => Number(c.y || 0) + Number(c.h || 1))));
}

function makeComponent(type, overrides = {}) {
  const [x,_y,w,h] = defaultGeometry(type);
  const page = currentPage();
  return {
    id: uid("c"), type, x, y: nextY(page), w, h,
    props: { ...defaultProps(type), ...(overrides.props || {}) },
    updated_ms: nowMs(), ...Object.fromEntries(Object.entries(overrides).filter(([k]) => k !== "props"))
  };
}

function addComponent(type) {
  if (readonly) return;
  const page = currentPage(); if (!page) return;
  const component = makeComponent(type);
  page.components.push(component);
  queueOps([{ op: "add_component", page_id: page.id, component }]);
  renderPage(); renderPageList(); selectComponent(component.id);
  if (type === "image") setTimeout(() => chooseImage(component.id), 80);
}

function participantNames() {
  const names = participants.map(item => String(item.name || "").trim()).filter(Boolean);
  if (names.length) return [...new Set(names)];
  return Array.isArray(project?.members) && project.members.length ? project.members : [me.name || "Integrante"];
}

function pageTemplate(id) {
  const members = participantNames();
  const subject = project?.subject || "MATERIA";
  const title = project?.title || "Título de la tarea";
  const professor = project?.professor || "Profesor/a";
  const component = (type,x,y,w,h,props={}) => ({id:uid("c"),type,x,y,w,h,props:{...defaultProps(type),...props},updated_ms:nowMs()});
  const base = { id:uid("page"), name:"Página", kind:"free", background:"#ffffff", components:[] };

  if (id === "cover-project") return {...base,name:"Portada",kind:"cover",components:[
    component("meta",0,1,8,4,{eyebrow:"PROYECTO INTEGRADOR",title,subtitle:"Documento académico · UCOM",variant:"cover-brand",accent:"teal"}),
    component("card",8,1,4,4,{label:"ASIGNATURA",title:subject,text:professor,variant:"soft",accent:"teal"}),
    component("paragraph",0,6,7,3,{text:"Una síntesis breve que explique el propósito del trabajo y establezca su tono desde la portada.",variant:"lead"}),
    component("members",0,17,7,4,{label:members.length===1?"ESTUDIANTE":"INTEGRANTES",members,variant:"default",accent:"teal"}),
    component("card",8,17,4,4,{label:"AÑO",title:String(new Date().getFullYear()),text:"Universidad Comunera",variant:"soft",accent:"orange"})
  ]};

  if (id === "editorial-opening") return {...base,name:"Apertura editorial",kind:"narrative",components:[
    component("meta",0,0,12,4,{eyebrow:subject.toUpperCase(),title:"Nombre del proyecto",subtitle:"Una frase breve que funcione como identidad del trabajo.",variant:"cover-brand",accent:"red"}),
    component("heading",0,5,12,3,{label:"PROPUESTA",title,title: title,variant:"default",accent:"red"}),
    component("paragraph",0,8,12,2,{text:"Una bajada de una o dos líneas para explicar el enfoque del proyecto.",variant:"lead"}),
    component("members",0,11,12,4,{label:members.length===1?"INTEGRANTE":"INTEGRANTES",members,variant:"inline",accent:"red"}),
    component("divider",0,16,12,1,{variant:"default",accent:"red"}),
    component("heading",0,18,12,2,{label:"01",title:"Primera sección",variant:"default",accent:"red"}),
    component("paragraph",0,20,12,6,{text:"El desarrollo comienza en la misma página de apertura, con una composición editorial y mucho espacio en blanco.",variant:"default"})
  ]};

  if (id === "executive") return {...base,name:"Resumen ejecutivo",kind:"cards",components:[
    component("heading",0,0,12,3,{label:"RESUMEN EJECUTIVO",title:"Una transición diseñada para la realidad del problema",variant:"sectionbar",accent:"teal"}),
    component("paragraph",0,3,12,3,{text:"Introducción ejecutiva de pocas líneas. Explica contexto, alcance y decisión central sin saturar la página.",variant:"lead"}),
    component("callout",0,6,12,3,{text:"Decisión central: esta caja resume la idea que debe recordar el lector.",variant:"soft-orange",accent:"orange"}),
    component("card",0,10,4,5,{label:"01",title:"Primer eje",text:"Descripción breve del primer alcance.",variant:"default",accent:"teal"}),
    component("card",4,10,4,5,{label:"02",title:"Segundo eje",text:"Descripción breve del segundo alcance.",variant:"default",accent:"blue"}),
    component("card",8,10,4,5,{label:"03",title:"Tercer eje",text:"Descripción breve del tercer alcance.",variant:"default",accent:"green"})
  ]};

  if (id === "matrix") return {...base,name:"Matriz",kind:"matrix",components:[
    component("heading",0,0,12,3,{label:"CONTINUACIÓN",title:"Componentes, ubicación y función",variant:"sectionbar",accent:"teal"}),
    component("paragraph",0,3,12,2,{text:"Una línea explica qué información organiza la matriz y por qué importa.",variant:"small"}),
    component("table",0,5,12,9,{columns:["Componente","Dónde se usa","Cómo se usa","Por qué se elige"],rows:[["Herramienta 1","Ubicación","Aplicación concreta","Justificación"],["Herramienta 2","Ubicación","Aplicación concreta","Justificación"],["Herramienta 3","Ubicación","Aplicación concreta","Justificación"]],variant:"default",accent:"teal"}),
    component("callout",0,15,12,3,{text:"Dato principal: una conclusión o criterio importante inmediatamente debajo de la tabla.",variant:"default",accent:"teal"})
  ]};

  if (id === "process") return {...base,name:"Proceso",kind:"process",components:[
    component("heading",0,0,12,3,{label:"DESARROLLO",title:"Flujo de trabajo propuesto",variant:"sectionbar",accent:"teal"}),
    component("paragraph",0,3,12,2,{text:"Antes de mostrar el flujo, una frase explica qué transforma el proceso.",variant:"small"}),
    component("card",0,6,6,6,{label:"ANTES",title:"Flujo tradicional",text:"1. Paso actual\n2. Problema\n3. Dependencia\n4. Resultado",variant:"soft",accent:"red"}),
    component("card",6,6,6,6,{label:"DESPUÉS",title:"Flujo propuesto",text:"1. Nuevo ingreso\n2. Registro\n3. Responsable\n4. Cierre",variant:"soft",accent:"green"}),
    component("process",0,14,12,5,{steps:[{title:"Entrada",text:"Se registra"},{title:"Canal",text:"Se organiza"},{title:"Responsable",text:"Se procesa"},{title:"Resultado",text:"Queda trazable"}],variant:"default",accent:"teal"})
  ]};

  if (id === "visual") return {...base,name:"Evidencia visual",kind:"visual",components:[
    component("heading",0,0,12,3,{label:"EVIDENCIA VISUAL",title:"Visualización de la propuesta",variant:"default",accent:"red"}),
    component("paragraph",0,3,12,4,{text:"Un breve texto contextualiza la imagen. La evidencia ocupa el protagonismo visual de la página y no queda encerrada en una tarjeta pequeña.",variant:"default"}),
    component("image",0,8,12,15,{caption:"Imagen principal · evidencia del proyecto",variant:"contain",accent:"red"})
  ]};

  if (id === "dashboard") return {...base,name:"Dashboard",kind:"dashboard",components:[
    component("heading",0,0,12,3,{label:"DEMO DEL PROCESO",title:"Evidencia visual y acceso a la demo",variant:"sectionbar",accent:"teal"}),
    component("paragraph",0,3,12,2,{text:"La página combina indicadores, una evidencia de datos y un acceso destacado.",variant:"small"}),
    component("table",0,6,12,6,{columns:["Sucursal","Ventas","Caja","Inventario","Actualizado"],rows:[["Centro","₲ 12.480.000","₲ 2.410.000","₲ 418.000.000","09:25"],["Luque","₲ 8.720.000","₲ 1.660.000","₲ 276.000.000","09:25"]],variant:"light",accent:"teal"}),
    component("kpis",0,13,12,4,{kpis:[{value:"₲ 58,87 M",label:"Ventas del día"},{value:"₲ 11,46 M",label:"Caja consolidada"},{value:"₲ 1.892 M",label:"Inventario"},{value:"09:25",label:"Actualización"}],variant:"default",accent:"teal"}),
    component("card",0,18,12,5,{label:"ACCESO",title:"Demo funcional",text:"Agregá aquí el enlace, QR o instrucciones de acceso.",variant:"soft",accent:"orange"})
  ]};

  if (id === "conclusion") return {...base,name:"Conclusión",kind:"conclusion",components:[
    component("heading",0,1,12,3,{label:"CONCLUSIÓN",title:"Una conclusión debe cerrar la idea, no repetirla",variant:"default",accent:"green"}),
    component("quote",0,5,12,4,{text:"El camino técnicamente ideal no siempre es el camino organizacionalmente correcto.",variant:"default",accent:"green"}),
    component("paragraph",0,10,12,10,{text:"Desarrollá la conclusión en párrafos claros, conectando la propuesta con el problema original y explicando por qué la decisión tomada resulta adecuada.",variant:"lead"})
  ]};

  return {...base,name:"Página en blanco",kind:"free",components:[]};
}

const PAGE_TEMPLATES = [
  ["cover-project","Portada de proyecto","Portada fuerte con datos académicos y equipo","project"],
  ["editorial-opening","Apertura editorial","Título, identidad, integrantes y comienzo de contenido","editorial"],
  ["executive","Resumen ejecutivo","Idea central, destacado y tres ejes","executive"],
  ["matrix","Matriz / tabla","Encabezado, tabla extensa y conclusión","matrix"],
  ["process","Proceso","Antes / después y flujo por etapas","process"],
  ["visual","Evidencia visual","Texto breve + imagen protagonista","visual"],
  ["dashboard","Dashboard","Tabla, KPIs y evidencia de demo","dashboard"],
  ["conclusion","Conclusión","Cierre editorial con frase principal","classic"],
  ["blank","En blanco","Página libre con grilla de 12 columnas","minimal"],
];

function buildTemplateDialog() {
  const host = $("#pageTemplateGrid");
  host.replaceChildren(...PAGE_TEMPLATES.map(([id,name,desc,preview]) => {
    const button = document.createElement("button");
    button.type = "button"; button.className = "template-card";
    button.innerHTML = `<div class="template-preview ${escapeHtml(preview)}"><div class="pv-kicker"></div><div class="pv-title"></div><div class="pv-text"></div>${preview === "visual" ? '<div class="pv-image"></div>' : '<div class="pv-grid"><i></i><i></i><i></i></div>'}</div><div class="template-copy"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(desc)}</span></div>`;
    button.addEventListener("click", () => addPageFromTemplate(id));
    return button;
  }));
}
function openTemplateDialog() { if (!readonly) $("#pageTemplateDialog").showModal(); }

function addPageFromTemplate(templateId) {
  if (readonly) return;
  const page = pageTemplate(templateId);
  const current = currentPage();
  const index = Math.max(0, state.pages.findIndex(p => p.id === current?.id));
  state.pages.splice(index + 1, 0, page);
  queueOps([{ op:"add_page", after_id: current?.id || "", page }]);
  currentPageId = page.id; selectedComponentId = "";
  $("#pageTemplateDialog").close();
  renderPageList(); renderPage(); heartbeat(true);
}

function duplicatePage() {
  if (readonly) return;
  const source = currentPage(); if (!source) return;
  const copy = deepClone(source); copy.id = uid("page"); copy.name = `${source.name} · copia`;
  copy.components = copy.components.map(component => ({...component,id:uid("c"),updated_ms:nowMs()}));
  const index = state.pages.findIndex(page => page.id === source.id);
  state.pages.splice(index + 1, 0, copy);
  queueOps([{op:"add_page",after_id:source.id,page:copy}]);
  currentPageId = copy.id; selectedComponentId = ""; renderPageList(); renderPage(); heartbeat(true);
}

function deletePage() {
  if (readonly || state.pages.length <= 1) return;
  const page = currentPage(); if (!page) return;
  if (!confirm(`¿Eliminar “${page.name}”?`)) return;
  const index = state.pages.findIndex(p => p.id === page.id);
  state.pages.splice(index,1);
  queueOps([{op:"delete_page",page_id:page.id}]);
  currentPageId = state.pages[Math.min(index,state.pages.length-1)].id; selectedComponentId="";
  renderPageList(); renderPage(); heartbeat(true);
}

function movePage(pageId, delta) {
  if (readonly) return;
  const index = state.pages.findIndex(p => p.id === pageId); if (index < 0) return;
  const next = Math.max(0,Math.min(state.pages.length-1,index+delta)); if (next===index) return;
  const [page] = state.pages.splice(index,1); state.pages.splice(next,0,page);
  queueOps([{op:"move_page",page_id:pageId,index:next}]); renderPageList(); updateFooter();
}

function patchCurrentPage(patch) {
  if (readonly) return;
  const page=currentPage(); if(!page)return;
  Object.assign(page,patch);
  queueOps([{op:"patch_page",page_id:page.id,patch}]);
  renderPageList(); renderPageChrome();
}

function renderPageList() {
  const host=$("#pageList"); if(!state)return;
  host.replaceChildren(...state.pages.map((page,index)=>{
    const wrap=document.createElement("div");wrap.className="page-thumb-wrap";
    const num=document.createElement("div");num.className="page-index";num.textContent=String(index+1);
    const cell=document.createElement("div");
    const thumb=document.createElement("button");thumb.type="button";thumb.className=`page-thumb${page.id===currentPageId?" active":""}`;thumb.title=page.name;
    const count=page.components?.length||0;
    thumb.innerHTML=`<div class="page-thumb-content"><div class="thumb-topline"></div><div class="thumb-title"></div><div class="thumb-sub"></div><div class="thumb-blocks"><i></i><i></i>${count>2?'<i></i>':''}${count>3?'<i></i>':''}</div></div>`;
    thumb.addEventListener("click",()=>selectPage(page.id));
    const meta=document.createElement("div");meta.className="page-thumb-meta";meta.textContent=page.name;
    const actions=document.createElement("div");actions.className="thumb-actions";
    if(page.id===currentPageId&&!readonly){
      const up=document.createElement("button");up.type="button";up.textContent="↑";up.title="Subir";up.addEventListener("click",e=>{e.stopPropagation();movePage(page.id,-1)});
      const down=document.createElement("button");down.type="button";down.textContent="↓";down.title="Bajar";down.addEventListener("click",e=>{e.stopPropagation();movePage(page.id,1)});
      actions.append(up,down);
    }
    cell.append(thumb,meta,actions);wrap.append(num,cell);return wrap;
  }));
}

function selectPage(pageId) {
  if (!state.pages.some(page=>page.id===pageId)) return;
  currentPageId=pageId;selectedComponentId="";renderPageList();renderPage();heartbeat(true);
  provider?.awareness?.setLocalStateField("composer",{pageId:currentPageId,componentId:"",clientId});
}

function renderPage() {
  const page=currentPage();if(!page)return;
  rendering=true;
  selectedComponentId="";
  $("#pageKindLabel").textContent=page.kind.toUpperCase();
  $("#pageNameLabel").textContent=page.name;
  $("#pageNameInput").value=page.name;
  $("#pageBackgroundInput").value=/^#[0-9a-f]{6}$/i.test(page.background||"")?page.background:"#ffffff";
  const paper=$("#paper"); paper.dataset.kind=page.kind; paper.dataset.pageNumber=String(pageIndex()+1); paper.style.background=page.background||"#ffffff";
  applyTheme(); updateFooter();
  if(grid){try{grid.destroy(false)}catch{} grid=null;}
  const host=$("#grid");host.replaceChildren();
  grid=GridStack.init({column:12,cellHeight:CELL_H,margin:8,float:true,animate:true,maxRow:28,minRow:28,disableOneColumnMode:true,staticGrid:readonly,draggable:{handle:".component-drag",scroll:true},resizable:{handles:"se"}},host);
  for(const component of page.components) addGridWidget(component);
  grid.on("change",(_event,items)=>onGridChange(items));
  rendering=false;
  updateInspector();
  renderRemoteEditing();
}

function updateFooter(){const page=currentPage();if(!page)return;$("#footerSubject").textContent=project?.subject||"UCOM";$("#footerPage").textContent=page.kind==="cover"?"":String(pageIndex()+1);}
function renderPageChrome(){const page=currentPage();if(!page)return;$("#pageNameLabel").textContent=page.name;$("#paper").style.background=page.background||"#ffffff";}

function addGridWidget(component){
  const item=document.createElement("div");item.className="grid-stack-item";item.dataset.componentId=component.id;
  const content=document.createElement("div");content.className="grid-stack-item-content";content.appendChild(renderComponent(component));item.appendChild(content);
  grid.addWidget(item,{x:component.x,y:component.y,w:component.w,h:component.h,id:component.id,noMove:readonly,noResize:readonly});
  item.addEventListener("pointerdown",event=>{if(event.target.closest(".editable"))return;selectComponent(component.id)});
  if(component.id===selectedComponentId)item.classList.add("selected");
}

function accentValue(component){return ACCENTS[component?.props?.accent]||ACCENTS.teal}
function applyComponentVars(shell,component){shell.style.setProperty("--paper-accent",accentValue(component));shell.style.setProperty("--paper-accent-2",ACCENTS.orange);}

function renderComponent(component,{staticMode=false}={}){
  const shell=document.createElement("div");shell.className=`component-shell comp-${component.type}${component.props?.variant?` variant-${component.props.variant}`:""}`;shell.dataset.componentId=component.id;applyComponentVars(shell,component);
  if(!staticMode){const bar=document.createElement("div");bar.className="component-bar";bar.innerHTML=`<span class="component-chip">${escapeHtml(TYPES[component.type]?.label||component.type)}</span><button class="component-drag" type="button" aria-label="Mover">⠿</button>`;shell.appendChild(bar);}
  const body=document.createElement("div");body.className="component-body";shell.appendChild(body);
  const editable=(tag,className,prop,placeholder="")=>{
    const el=document.createElement(tag);el.className=`${className} editable`;el.dataset.prop=prop;el.dataset.placeholder=placeholder;el.contentEditable=(!readonly&&!staticMode)?"true":"false";bindTextEditable(el,component,prop);return el;
  };
  if(component.type==="title"){
    body.append(editable("div","title-eyebrow","eyebrow","Etiqueta"),editable("div","title-main","title","Título"),editable("div","title-subtitle","subtitle","Subtítulo"));
  }else if(component.type==="heading"){
    body.append(editable("div","heading-kicker","label","SECCIÓN"),editable("div","heading-main","title","Título de sección"));
  }else if(component.type==="paragraph"){
    const el=editable("div","paragraph-text","text","Escribí aquí…");body.append(el);
  }else if(component.type==="callout"||component.type==="quote"){
    body.append(editable("div",component.type==="quote"?"quote-text":"callout-text","text","Texto destacado"));
  }else if(component.type==="card"){
    body.append(editable("div","card-label","label","CATEGORÍA"),editable("div","card-title","title","Título"),editable("div","card-text","text","Descripción"));
  }else if(component.type==="members"){
    const label=editable("div","members-label","label","INTEGRANTES");body.append(label);const list=document.createElement("div");list.className="members-list";body.append(list);
    const values=Array.isArray(component.props?.members)?component.props.members:participantNames();
    values.forEach((name,index)=>{const el=document.createElement("div");el.className="editable member-line";el.contentEditable=(!readonly&&!staticMode)?"true":"false";el.textContent=name;el.dataset.index=String(index);el.addEventListener("focus",()=>selectComponent(component.id));el.addEventListener("input",()=>{const next=[...values];next[index]=el.innerText.replace(/\n/g," ");component.props.members=next;markDirty(component.id);scheduleArrayPatch(component,"members",next)});list.appendChild(el)});
  }else if(component.type==="meta"){
    body.append(editable("div","meta-eyebrow","eyebrow","MATERIA"),editable("div","meta-title","title","Título"),editable("div","meta-subtitle","subtitle","Datos académicos"));
  }else if(component.type==="table"){
    renderTable(body,component,staticMode);
  }else if(component.type==="process"){
    renderProcess(body,component,staticMode);
  }else if(component.type==="kpis"){
    renderKpis(body,component,staticMode);
  }else if(component.type==="image"){
    renderImage(body,component,staticMode);
  }else if(component.type==="divider"){
    // CSS renders the line.
  }
  if(!staticMode)shell.addEventListener("pointerdown",()=>selectComponent(component.id));
  return shell;
}

function bindTextEditable(el,component,prop){
  const initial=String(component.props?.[prop]??"");
  el.textContent=initial;
  if(readonly)return;
  const key=`${component.id}:${prop}`;
  let ytext=null;
  if(yTexts){
    if(yTexts.has(key)){const existing=yTexts.get(key);if(existing instanceof Y.Text)ytext=existing;}
    else{ytext=new Y.Text(initial);ydoc.transact(()=>yTexts.set(key,ytext),"composer-seed");}
  }
  let last=ytext?ytext.toString():initial;
  if(ytext&&last!==initial&&!locallyDirty(component.id)){component.props[prop]=last;el.textContent=last;}
  const observer=()=>{
    const next=ytext.toString();if(next===el.innerText)return;
    component.props[prop]=next;
    if(document.activeElement===el){replaceActiveTextPreservingCaret(el,next);}else el.textContent=next;
    scheduleTextApiPatch(component,prop,next);
  };
  if(ytext){ytext.observe(observer);textObservers.set(el,{ytext,observer});}
  el.addEventListener("compositionstart",()=>composing.add(el));el.addEventListener("compositionend",()=>composing.delete(el));
  el.addEventListener("focus",()=>{selectComponent(component.id);heartbeat(true);provider?.awareness?.setLocalStateField("composer",{pageId:currentPageId,componentId:component.id,clientId});});
  el.addEventListener("input",()=>{
    const next=el.innerText;
    component.props[prop]=next;component.updated_ms=nowMs();markDirty(component.id,2200);
    if(ytext){const before=ytext.toString();if(before!==next)ydoc.transact(()=>diffText(ytext,before,next),"composer-input");}
    scheduleTextApiPatch(component,prop,next);
  });
  el.addEventListener("blur",()=>{if(ytext&&el.innerText!==ytext.toString())el.textContent=ytext.toString();});
}

function diffText(ytext,before,after){let p=0,c=Math.min(before.length,after.length);while(p<c&&before[p]===after[p])p++;let oe=before.length,ne=after.length;while(oe>p&&ne>p&&before[oe-1]===after[ne-1]){oe--;ne--}if(oe>p)ytext.delete(p,oe-p);if(ne>p)ytext.insert(p,after.slice(p,ne));}
function caretOffset(el){const sel=getSelection();if(!sel||!sel.rangeCount||!el.contains(sel.anchorNode))return null;const range=sel.getRangeAt(0).cloneRange();range.selectNodeContents(el);range.setEnd(sel.anchorNode,sel.anchorOffset);return range.toString().length;}
function setCaretOffset(el,offset){const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let left=Math.max(0,offset),node;while((node=walker.nextNode())){if(left<=node.nodeValue.length){const r=document.createRange();r.setStart(node,left);r.collapse(true);const s=getSelection();s.removeAllRanges();s.addRange(r);return}left-=node.nodeValue.length;}const r=document.createRange();r.selectNodeContents(el);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r);}
function replaceActiveTextPreservingCaret(el,next){const pos=caretOffset(el);el.textContent=next;if(pos!=null)setCaretOffset(el,Math.min(pos,next.length));}

const textPatchTimers=new Map();
function scheduleTextApiPatch(component,prop,value){
  const key=`${component.id}:${prop}`;clearTimeout(textPatchTimers.get(key));textPatchTimers.set(key,setTimeout(()=>{
    const stamp=nowMs();component.updated_ms=stamp;patchComponent(component.id,{props:{[prop]:value},updated_ms:stamp},{dirty:true,quiet:true});
  },320));
}
const arrayPatchTimers=new Map();
function scheduleArrayPatch(component,prop,value){const key=`${component.id}:${prop}`;clearTimeout(arrayPatchTimers.get(key));arrayPatchTimers.set(key,setTimeout(()=>patchComponent(component.id,{props:{[prop]:value},updated_ms:nowMs()},{dirty:true,quiet:true}),380));}

function renderTable(body,component,staticMode){
  const columns=Array.isArray(component.props?.columns)?component.props.columns:["Columna 1","Columna 2"];
  const rows=Array.isArray(component.props?.rows)?component.props.rows:[["Dato","Dato"]];
  const table=document.createElement("table"),thead=document.createElement("thead"),trh=document.createElement("tr");
  columns.forEach((value,index)=>{const th=document.createElement("th");th.textContent=value;th.contentEditable=(!readonly&&!staticMode)?"true":"false";th.addEventListener("focus",()=>selectComponent(component.id));th.addEventListener("input",()=>{columns[index]=th.innerText;component.props.columns=columns;markDirty(component.id);scheduleArrayPatch(component,"columns",columns)});trh.appendChild(th)});thead.appendChild(trh);table.appendChild(thead);
  const tbody=document.createElement("tbody");rows.forEach((row,r)=>{const tr=document.createElement("tr");columns.forEach((_,c)=>{const td=document.createElement("td");td.textContent=String(row?.[c]??"");td.contentEditable=(!readonly&&!staticMode)?"true":"false";td.addEventListener("focus",()=>selectComponent(component.id));td.addEventListener("input",()=>{while(rows.length<=r)rows.push([]);rows[r][c]=td.innerText;component.props.rows=rows;markDirty(component.id);scheduleArrayPatch(component,"rows",rows)});tr.appendChild(td)});tbody.appendChild(tr)});table.appendChild(tbody);body.appendChild(table);
}

function renderProcess(body,component,staticMode){
  const steps=Array.isArray(component.props?.steps)&&component.props.steps.length?component.props.steps:[{title:"Paso 1",text:"Descripción"}];
  steps.forEach((step,index)=>{const card=document.createElement("div");card.className="process-step";const num=document.createElement("span");num.className="process-index";num.textContent=String(index+1);const title=document.createElement("div");title.className="process-title editable";title.contentEditable=(!readonly&&!staticMode)?"true":"false";title.textContent=step.title||"";const text=document.createElement("div");text.className="process-text editable";text.contentEditable=(!readonly&&!staticMode)?"true":"false";text.textContent=step.text||"";for(const [el,key] of [[title,"title"],[text,"text"]]){el.addEventListener("focus",()=>selectComponent(component.id));el.addEventListener("input",()=>{steps[index][key]=el.innerText;component.props.steps=steps;markDirty(component.id);scheduleArrayPatch(component,"steps",steps)})}card.append(num,title,text);body.appendChild(card)});
}

function renderKpis(body,component,staticMode){
  const kpis=Array.isArray(component.props?.kpis)&&component.props.kpis.length?component.props.kpis:[{value:"100%",label:"Indicador"}];
  kpis.forEach((kpi,index)=>{const card=document.createElement("div");card.className="kpi-card";const value=document.createElement("div");value.className="kpi-value editable";value.contentEditable=(!readonly&&!staticMode)?"true":"false";value.textContent=kpi.value||"";const label=document.createElement("div");label.className="kpi-label editable";label.contentEditable=(!readonly&&!staticMode)?"true":"false";label.textContent=kpi.label||"";for(const [el,key] of [[value,"value"],[label,"label"]]){el.addEventListener("focus",()=>selectComponent(component.id));el.addEventListener("input",()=>{kpis[index][key]=el.innerText;component.props.kpis=kpis;markDirty(component.id);scheduleArrayPatch(component,"kpis",kpis)})}card.append(value,label);body.appendChild(card)});
}

function renderImage(body,component,staticMode){
  const fileId=String(component.props?.image_file_id||"");
  if(fileId){const img=document.createElement("img");img.alt=component.props?.caption||"Imagen";body.appendChild(img);loadImage(fileId).then(url=>{if(img.isConnected)img.src=url}).catch(()=>{});}
  else{const empty=document.createElement("button");empty.type="button";empty.className="image-empty";empty.innerHTML="<strong>＋</strong><span>Agregar imagen</span>";if(!staticMode&&!readonly)empty.addEventListener("click",e=>{e.stopPropagation();chooseImage(component.id)});body.appendChild(empty);}
}

async function loadImage(fileId){if(imageCache.has(fileId))return imageCache.get(fileId);const response=await fetch(`${API}/api/projects/${encodeURIComponent(idFromHash())}/images-v25/${encodeURIComponent(fileId)}`,{headers:{Authorization:`Bearer ${token(idFromHash())}`}});if(!response.ok)throw new Error("No se pudo cargar la imagen");const blob=await response.blob();const url=URL.createObjectURL(blob);imageCache.set(fileId,url);return url;}
function chooseImage(componentId){if(readonly)return;const input=document.createElement("input");input.type="file";input.accept="image/jpeg,image/png,image/webp";input.addEventListener("change",async()=>{const file=input.files?.[0];if(!file)return;try{const form=new FormData();form.append("file",file);const data=await request("POST",`/api/projects/${encodeURIComponent(idFromHash())}/images-v25`,form);const fileId=data.image?.file_id;if(fileId){patchComponent(componentId,{props:{image_file_id:fileId},updated_ms:nowMs()},{dirty:true,quiet:false});const component=findComponent(componentId);if(component)component.props.image_file_id=fileId;updateComponentDOM(componentId);}}catch(error){toast(error.message||"No se pudo subir la imagen",true)}});input.click();}

function onGridChange(items){
  if(rendering||readonly||!items?.length)return;
  const page=currentPage();if(!page)return;
  const changed=[];
  for(const node of items){const id=node.el?.dataset?.componentId||node.id;const component=findComponent(id,page);if(!component)continue;component.x=node.x;component.y=node.y;component.w=node.w;component.h=node.h;markDirty(component.id,1200);changed.push({component,patch:{x:node.x,y:node.y,w:node.w,h:node.h}});}
  clearTimeout(geometryTimer);geometryTimer=setTimeout(()=>{const ops=changed.map(({component,patch})=>({op:"patch_component",page_id:page.id,component_id:component.id,patch}));queueOps(ops,{quiet:true});updateInspector();renderPageList();},180);
}

function selectComponent(componentId){
  selectedComponentId=componentId||"";
  $$(".grid-stack-item",$("#grid")).forEach(item=>item.classList.toggle("selected",item.dataset.componentId===selectedComponentId));
  updateInspector();renderRemoteEditing();heartbeat(true);
  provider?.awareness?.setLocalStateField("composer",{pageId:currentPageId,componentId:selectedComponentId,clientId});
}

function updateInspector(){
  const component=findComponent(selectedComponentId);
  $("#documentControls").classList.toggle("hidden",!!component);
  $("#componentControls").classList.toggle("hidden",!component);
  if(!component)return;
  selectInspectorTab("style");
  $("#selectedTypeLabel").textContent=TYPES[component.type]?.label||component.type;
  $("#componentTypeSelect").innerHTML=Object.entries(TYPES).filter(([t])=>t!=="spacer").map(([value,meta])=>`<option value="${value}">${escapeHtml(meta.label)}</option>`).join("");
  $("#componentTypeSelect").value=component.type;
  $("#componentWidth").value=component.w;$("#componentHeight").value=component.h;
  const variants=VARIANTS[component.type]||[["default","Normal"]];
  $("#componentVariantSelect").innerHTML=variants.map(([v,l])=>`<option value="${v}">${escapeHtml(l)}</option>`).join("");
  $("#componentVariantSelect").value=component.props?.variant||variants[0][0];
  $("#componentAccentSelect").value=component.props?.accent||"teal";
  const editors=presence.filter(p=>p.component_id===component.id&&p.client_id!==clientId);
  $("#selectedEditorState").textContent=editors.length?`${editors[0].actor_name} editando`:"";
}

function patchSelectedProps(props){const component=findComponent(selectedComponentId);if(!component||readonly)return;component.props={...(component.props||{}),...props};patchComponent(component.id,{props,updated_ms:nowMs()},{dirty:true,quiet:true});updateComponentDOM(component.id);}
function changeSelectedType(type){const component=findComponent(selectedComponentId);if(!component||readonly||!TYPES[type])return;component.type=type;component.props={...defaultProps(type),...(component.props||{}),variant:(VARIANTS[type]||[["default"]])[0][0]};patchComponent(component.id,{type,props:component.props,updated_ms:nowMs()},{dirty:true,quiet:false});renderPage();selectComponent(component.id);}
function resizeSelected(w,h){const component=findComponent(selectedComponentId);if(!component||readonly)return;const patch={};if(w!=null)patch.w=Math.max(1,Math.min(12,w));if(h!=null)patch.h=Math.max(1,Math.min(28,h));Object.assign(component,patch);grid?.update($(`[data-component-id="${CSS.escape(component.id)}"]`,$("#grid")),patch);patchComponent(component.id,patch,{dirty:true,quiet:true});}
function duplicateSelectedComponent(){const source=findComponent(selectedComponentId);const page=currentPage();if(!source||!page||readonly)return;const copy=deepClone(source);copy.id=uid("c");copy.y=Math.min(38,source.y+1);copy.x=Math.min(11,source.x+1);copy.updated_ms=nowMs();page.components.push(copy);queueOps([{op:"add_component",page_id:page.id,component:copy}]);renderPage();selectComponent(copy.id);renderPageList();}
function deleteSelectedComponent(){const component=findComponent(selectedComponentId);const page=currentPage();if(!component||!page||readonly)return;page.components=page.components.filter(c=>c.id!==component.id);queueOps([{op:"delete_component",page_id:page.id,component_id:component.id}]);selectedComponentId="";renderPage();renderPageList();}

function updateComponentDOM(componentId){
  const component=findComponent(componentId);const item=$(`.grid-stack-item[data-component-id="${CSS.escape(componentId)}"]`,$("#grid"));if(!component||!item)return;
  const content=$(".grid-stack-item-content",item);const selected=item.classList.contains("selected");content.replaceChildren(renderComponent(component));item.classList.toggle("selected",selected);
}

function initRealtime(){
  const id=idFromHash(),auth=token(id);if(!auth)return;
  try{
    ydoc=new Y.Doc();yTexts=ydoc.getMap("composer-text-v31");provider=new WebsocketProvider(WS,id,ydoc,{params:{token:auth},connect:true});
    provider.on("status",event=>{realtimeConnected=event.status==="connected";setSaveState();});
    provider.on("connection-error",()=>{realtimeConnected=false;setSaveState();});
    provider.awareness.setLocalStateField("user",{name:me.name||"Integrante",email:me.email||"",role:me.role||"participant",clientId});
    provider.awareness.setLocalStateField("composer",{pageId:currentPageId,componentId:selectedComponentId,clientId});
    provider.awareness.on("change",()=>renderRemoteEditing());
  }catch(error){console.warn("UCOM Composer realtime",error);realtimeConnected=false;setSaveState();}
}

function renderRemoteEditing(){
  const remote=new Map();
  for(const p of presence){if(p.client_id!==clientId&&p.component_id)remote.set(p.component_id,p.actor_name);}
  if(provider){for(const [cid,s] of provider.awareness.getStates()){const c=s?.composer,u=s?.user;if(cid!==provider.awareness.clientID&&c?.componentId)remote.set(c.componentId,u?.name||"Integrante");}}
  $$(".component-shell",$("#grid")).forEach(shell=>{const name=remote.get(shell.dataset.componentId);shell.classList.toggle("remote-editing",!!name);if(name)shell.dataset.remoteEditor=`${name} editando`;else delete shell.dataset.remoteEditor;});
  updateInspector();
}

function startCollaborationLoops(){
  heartbeat(true);pollPresence();
  heartbeatTimer=setInterval(()=>heartbeat(false),5000);
  presenceTimer=setInterval(pollPresence,4500);
  pollTimer=setInterval(pollComposer,1300);
}

async function heartbeat(){
  const id=idFromHash();if(!id||!token(id))return;
  try{await request("POST",`/api/projects/${encodeURIComponent(id)}/composer-v31/presence`,{client_id:clientId,page_id:currentPageId,component_id:selectedComponentId});}catch{}
}
async function sendPresenceDelete(){const id=idFromHash();if(!id||!token(id))return;try{await request("DELETE",`/api/projects/${encodeURIComponent(id)}/composer-v31/presence/${encodeURIComponent(clientId)}`)}catch{}}
async function pollPresence(){
  const id=idFromHash();if(!id)return;
  try{const data=await request("GET",`/api/projects/${encodeURIComponent(id)}/composer-v31/presence`);presence=Array.isArray(data.presence)?data.presence:[];renderPresence();renderRemoteEditing();}catch{}
}

function renderPresence(){
  const host=$("#presenceStrip");const unique=[];const seen=new Set();
  for(const p of presence){const key=(p.email||p.actor_name||p.client_id).toLowerCase();if(seen.has(key))continue;seen.add(key);unique.push(p);}
  if(!unique.some(p=>p.client_id===clientId))unique.unshift({client_id:clientId,actor_name:me.name||"Yo",email:me.email||""});
  host.replaceChildren(...unique.slice(0,8).map(p=>{const el=document.createElement("div");el.className=`presence-avatar${p.client_id===clientId?" me":""}`;el.title=`${p.actor_name}${p.page_id?` · ${pageName(p.page_id)}`:""}`;el.textContent=initials(p.actor_name);return el;}));
  if(unique.length>8){const more=document.createElement("span");more.className="presence-more";more.textContent=`+${unique.length-8}`;host.appendChild(more);}
}
function initials(name){return String(name||"?").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join("")||"?"}
function pageName(id){return state?.pages?.find(p=>p.id===id)?.name||"Página"}

async function pollComposer(){
  if(apiSaving>0)return;
  const id=idFromHash();if(!id)return;
  try{const data=await request("GET",`/api/projects/${encodeURIComponent(id)}/composer-v31`);const remoteRevision=Number(data.revision||0);if(remoteRevision<=revision)return;mergeRemoteState(data.state);revision=remoteRevision;}catch{}
}

function mergeRemoteState(remote){
  if(!remote||!state)return;
  if(remote.theme!==state.theme){state.theme=remote.theme;applyTheme();}
  const localIds=state.pages.map(p=>p.id),remoteIds=remote.pages.map(p=>p.id);
  const pageStructureChanged=JSON.stringify(localIds)!==JSON.stringify(remoteIds);
  if(pageStructureChanged){state.pages=deepClone(remote.pages);if(!state.pages.some(p=>p.id===currentPageId))currentPageId=state.pages[0]?.id||"";renderPageList();renderPage();return;}
  let currentStructural=false;
  for(let i=0;i<remote.pages.length;i++){
    const rp=remote.pages[i],lp=state.pages[i];
    lp.name=rp.name;lp.kind=rp.kind;lp.background=rp.background;
    const lmap=new Map(lp.components.map(c=>[c.id,c]));const rmap=new Map(rp.components.map(c=>[c.id,c]));
    if(lp.id!==currentPageId){state.pages[i]=deepClone(rp);continue;}
    if(lp.components.length!==rp.components.length||[...lmap.keys()].some(id=>!rmap.has(id))){state.pages[i]=deepClone(rp);currentStructural=true;continue;}
    for(const rc of rp.components){const lc=lmap.get(rc.id);if(!lc)continue;
      if(!locallyDirty(rc.id)){
        const geoChanged=["x","y","w","h"].some(k=>lc[k]!==rc[k]);Object.assign(lc,{type:rc.type,x:rc.x,y:rc.y,w:rc.w,h:rc.h,updated_ms:rc.updated_ms});lc.props=deepClone(rc.props||{});
        if(geoChanged&&grid){const item=$(`.grid-stack-item[data-component-id="${CSS.escape(rc.id)}"]`,$("#grid"));if(item)grid.update(item,{x:rc.x,y:rc.y,w:rc.w,h:rc.h});}
        updateComponentFieldsIncremental(rc.id,rc);
      }
    }
  }
  renderPageList();renderPageChrome();if(currentStructural)renderPage();
}

function updateComponentFieldsIncremental(componentId,remote){
  const shell=$(`.component-shell[data-component-id="${CSS.escape(componentId)}"]`,$("#grid"));if(!shell)return;
  if(shell.classList.contains(`comp-${remote.type}`)===false){updateComponentDOM(componentId);return;}
  shell.style.setProperty("--paper-accent",accentValue(remote));
  [...shell.classList].filter(c=>c.startsWith("variant-")).forEach(c=>shell.classList.remove(c));if(remote.props?.variant)shell.classList.add(`variant-${remote.props.variant}`);
  $$('[data-prop]',shell).forEach(el=>{const prop=el.dataset.prop;const next=String(remote.props?.[prop]??"");if(document.activeElement!==el&&el.innerText!==next)el.textContent=next;});
  if(["table","process","kpis","members","image"].includes(remote.type)&&!locallyDirty(componentId))updateComponentDOM(componentId);
}

function renderPageTemplateStatic(page,index){
  const article=document.createElement("article");article.className=`print-page composer-paper theme-${state.theme}`;article.dataset.kind=page.kind;article.style.background=page.background||"#fff";
  const chrome=document.createElement("div");chrome.className="page-chrome";article.appendChild(chrome);
  for(const component of page.components){const el=renderComponent(component,{staticMode:true});el.classList.add("print-component");const col=GRID_W/12;el.style.left=`${PAGE_X+component.x*col+4}px`;el.style.top=`${PAGE_Y+component.y*CELL_H+4}px`;el.style.width=`${component.w*col-8}px`;el.style.height=`${component.h*CELL_H-8}px`;article.appendChild(el);}
  const footer=document.createElement("div");footer.className="paper-footer";footer.innerHTML=`<span>${escapeHtml(project?.subject||"UCOM")}</span><span>${page.kind==="cover"?"":String(index+1)}</span>`;article.appendChild(footer);return article;
}
function printDocument(){const root=$("#printRoot");root.replaceChildren(...state.pages.map(renderPageTemplateStatic));setTimeout(()=>window.print(),180);}

// CSS helper for page reorder controls injected here to keep the static shell small.
const helperStyle=document.createElement("style");helperStyle.textContent=`.thumb-actions{height:18px;display:flex;gap:3px;margin-top:3px}.thumb-actions button{width:20px;height:16px;padding:0;border:1px solid rgba(255,255,255,.08);background:#0d1b29;color:#7f93a4;border-radius:4px;font-size:9px}.thumb-actions button:hover{color:#fff;border-color:rgba(91,197,242,.3)}`;document.head.appendChild(helperStyle);

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
