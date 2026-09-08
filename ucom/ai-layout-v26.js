import * as Y from "https://cdn.jsdelivr.net/npm/yjs@13.6.32/+esm";
import { WebsocketProvider } from "https://cdn.jsdelivr.net/npm/y-websocket@3.1.0/+esm";

const WS = "wss://ucom-api.ufotech.com.py/ws";
const ADMIN_KEY = "ucom.admin.session.v2";
const GOOGLE_KEY = "ucom.google.session.v11";
const $ = (selector, root = document) => root.querySelector(selector);

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    style: { type: "string", enum: ["institutional", "minimal", "visual", "math"] },
    cover: { type: "boolean" },
    pageNumbers: { type: "boolean" },
    titleFont: { type: "string", enum: ["system", "arial", "georgia", "times", "verdana", "trebuchet"] },
    titleSize: { type: "integer", minimum: 28, maximum: 48 },
    sections: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["consigna", "desarrollo", "respuesta", "ejercicio", "texto", "formula", "nota"] },
          label: { type: "string", maxLength: 40 },
          title: { type: "string", maxLength: 80 },
          accent: { type: "string", enum: ["auto", "purple", "green", "yellow", "blue", "orange"] },
          height: { type: "integer", minimum: 70, maximum: 180 }
        },
        required: ["type", "label", "title", "accent", "height"]
      }
    }
  },
  required: ["style", "cover", "pageNumbers", "titleFont", "titleSize", "sections"]
};

const DEFAULT_PLAN = {
  style: "institutional",
  cover: false,
  pageNumbers: true,
  titleFont: "system",
  titleSize: 36,
  sections: [
    { type: "consigna", label: "Consigna", title: "Consigna", accent: "purple", height: 100 },
    { type: "desarrollo", label: "Desarrollo", title: "Desarrollo", accent: "green", height: 150 },
    { type: "texto", label: "Conclusión", title: "Conclusión", accent: "blue", height: 110 }
  ]
};

let currentProject = "";
let ydoc = null;
let provider = null;
let yBlocks = null;
let yLayout = null;
let yStyles = null;
let yDisplayNames = null;
let yConfig = null;
let currentPlan = null;
let participantTimer = 0;
let metaBound = false;
let legacyObserver = null;
let syncingLegacy = false;

const projectId = () => {
  const match = location.hash.match(/^#\/p\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : "";
};
const token = id => sessionStorage.getItem(ADMIN_KEY) || sessionStorage.getItem(`ucom.participant.${id}`) || localStorage.getItem(GOOGLE_KEY) || "";
const adminToken = () => sessionStorage.getItem(ADMIN_KEY) || "";
const finalized = () => $("#workspace")?.classList.contains("task-finalized-v18") || false;
const participants = () => window.UCOMDirectCanvasV23?.getState?.().participants || [];

function toast(message, error = false) {
  const box = $("#toast");
  if (!box) return;
  box.textContent = message;
  box.className = `toast show ${error ? "error" : ""}`;
  setTimeout(() => { if (box.textContent === message) box.className = "toast"; }, 3400);
}

function ensureText(record, key, fallback = "") {
  let value = record.get(key);
  if (value instanceof Y.Text) return value;
  const text = new Y.Text(value == null ? fallback : String(value));
  ydoc?.transact(() => record.set(key, text), "ucom-ai-normalize-v26");
  return text;
}

function replaceText(ytext, value) {
  const next = String(value || "");
  if (ytext.toString() === next) return;
  if (ytext.length) ytext.delete(0, ytext.length);
  if (next) ytext.insert(0, next);
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

function ensureUI() {
  const host = $("#canvasToolsV23");
  if (!host) return false;
  if (!$("#aiLayoutV26")) {
    const button = document.createElement("button");
    button.id = "aiLayoutV26";
    button.type = "button";
    button.className = "ghost ai-layout-launch-v26";
    button.textContent = "✦ Diseñar con IA";
    const imageWrap = $("#imageAddWrapV25", host);
    if (imageWrap) imageWrap.after(button); else host.appendChild(button);
    button.addEventListener("click", openPlanner);
  }
  ensureDialog();
  return true;
}

function ensureDialog() {
  if ($("#aiLayoutDialogV26")) return;
  const dialog = document.createElement("dialog");
  dialog.id = "aiLayoutDialogV26";
  dialog.className = "ai-layout-dialog-v26";
  dialog.innerHTML = `
    <div class="ai-layout-card-v26">
      <div class="ai-layout-head-v26">
        <div><span class="ai-badge-v26"><i></i> Maquetación</span><h2>Diseñar con IA</h2><p>Analiza la consigna y propone solamente estructura visual. No escribe respuestas ni desarrolla el trabajo.</p></div>
        <button id="aiCloseV26" class="icon-btn" type="button">×</button>
      </div>
      <div class="ai-source-v26"><strong>Indicaciones del profesor</strong><div id="aiSourceV26"></div></div>
      <div id="aiStateV26" class="ai-state-v26">Listo para analizar.</div>
      <div id="aiPlanV26" class="ai-plan-v26 hidden">
        <div class="ai-plan-grid-v26">
          <label>Estilo<select id="aiStyleV26"><option value="institutional">Institucional</option><option value="minimal">Monografía</option><option value="visual">Visual</option><option value="math">Matemáticas</option></select></label>
          <label><input id="aiCoverV26" type="checkbox"> Crear carátula</label>
          <label><input id="aiPagesV26" type="checkbox"> Numerar páginas</label>
          <label>Fuente título<select id="aiTitleFontV26"><option value="system">Sistema</option><option value="georgia">Georgia</option><option value="times">Times</option><option value="arial">Arial</option><option value="verdana">Verdana</option><option value="trebuchet">Trebuchet</option></select></label>
        </div>
        <div id="aiSectionsV26" class="ai-sections-v26"></div>
      </div>
      <div class="ai-actions-v26">
        <button id="aiAnalyzeV26" class="ghost" type="button">Analizar consigna</button>
        <button id="aiApplyV26" class="primary hidden" type="button">Aplicar formato</button>
      </div>
    </div>`;
  document.body.appendChild(dialog);
  $("#aiCloseV26")?.addEventListener("click", () => dialog.close());
  $("#aiAnalyzeV26")?.addEventListener("click", analyze);
  $("#aiApplyV26")?.addEventListener("click", applyCurrentPlan);
  $("#aiStyleV26")?.addEventListener("change", syncPlanControls);
  $("#aiCoverV26")?.addEventListener("change", syncPlanControls);
  $("#aiPagesV26")?.addEventListener("change", syncPlanControls);
  $("#aiTitleFontV26")?.addEventListener("change", syncPlanControls);
}

function openPlanner() {
  if (finalized()) { toast("La tarea está finalizada", true); return; }
  const dialog = $("#aiLayoutDialogV26");
  if (!dialog) return;
  const directives = String($("#directivesInput")?.value || "").trim();
  $("#aiSourceV26").textContent = directives || "No hay indicaciones cargadas. La IA usará materia, título y tipo de tarea.";
  setState("Listo para analizar.");
  $("#aiPlanV26")?.classList.add("hidden");
  $("#aiApplyV26")?.classList.add("hidden");
  currentPlan = null;
  dialog.showModal();
}

function setState(message, kind = "", spinning = false) {
  const box = $("#aiStateV26");
  if (!box) return;
  box.className = `ai-state-v26${kind ? ` ${kind}` : ""}`;
  box.replaceChildren();
  if (spinning) { const spinner = document.createElement("i"); spinner.className = "ai-spinner-v26"; box.appendChild(spinner); }
  box.append(document.createTextNode(message));
}

function taskContext() {
  return {
    subject: String($("#subjectInput")?.value || "").trim(),
    title: String($("#titleInput")?.value || "").trim(),
    professor: String($("#professorInput")?.value || "").trim(),
    directives: String($("#directivesInput")?.value || "").trim().slice(0, 7000),
    workType: String($("#workTypeInput")?.value || "group"),
    participantCount: participants().length
  };
}

function fallbackPlan(context) {
  const text = `${context.subject}\n${context.title}\n${context.directives}`.toLocaleLowerCase();
  const style = /matem|ecuaci|fórmul|formula|cálculo|calculo|estadíst/.test(text) ? "math" : /infograf|presentaci|visual|gráfic|grafico|imagen|cuadro/.test(text) ? "visual" : /monograf|ensayo|informe|investig/.test(text) ? "minimal" : "institutional";
  const cover = /carátula|caratula|portada/.test(text);
  const pageNumbers = !/sin numer|no numer/.test(text);
  const candidates = [
    ["Objetivos", /objetiv/], ["Introducción", /introducci/], ["Marco teórico", /marco te[oó]rico/], ["Metodología", /metodolog/], ["Análisis", /an[aá]lisis/], ["Desarrollo", /desarroll/], ["Ejercicios", /ejercicio|problema/], ["Resultados", /resultado/], ["Conclusión", /conclusi/], ["Bibliografía", /bibliograf|referencia/], ["Anexos", /anexo/]
  ];
  const found = candidates.filter(([, regex]) => regex.test(text)).map(([label]) => label);
  const labels = found.length ? found.slice(0, 6) : ["Consigna", "Desarrollo", "Conclusión"];
  const accents = ["purple", "green", "blue", "orange", "yellow", "purple"];
  const sections = labels.map((label, index) => ({
    type: /ejercicio|problema/i.test(label) ? "ejercicio" : /consigna/i.test(label) ? "consigna" : /conclus|bibliograf|anexo|introduc|objetiv|metodolog|marco|resultado/i.test(label) ? "texto" : "desarrollo",
    label,
    title: label,
    accent: accents[index % accents.length],
    height: index === 1 ? 150 : 105
  }));
  return { style, cover, pageNumbers, titleFont: style === "minimal" ? "georgia" : "system", titleSize: style === "visual" ? 42 : 36, sections };
}

function normalizePlan(raw, context) {
  const fallback = fallbackPlan(context);
  if (!raw || typeof raw !== "object") return fallback;
  const allowedStyles = new Set(["institutional", "minimal", "visual", "math"]);
  const allowedFonts = new Set(["system", "arial", "georgia", "times", "verdana", "trebuchet"]);
  const allowedTypes = new Set(["consigna", "desarrollo", "respuesta", "ejercicio", "texto", "formula", "nota"]);
  const allowedAccents = new Set(["auto", "purple", "green", "yellow", "blue", "orange"]);
  const sections = Array.isArray(raw.sections) ? raw.sections.slice(0, 6).map((section, index) => ({
    type: allowedTypes.has(section?.type) ? section.type : "texto",
    label: String(section?.label || section?.title || `Sección ${index + 1}`).slice(0, 40),
    title: String(section?.title || section?.label || `Sección ${index + 1}`).slice(0, 80),
    accent: allowedAccents.has(section?.accent) ? section.accent : "auto",
    height: Math.max(70, Math.min(180, Number(section?.height) || 105))
  })) : [];
  return {
    style: allowedStyles.has(raw.style) ? raw.style : fallback.style,
    cover: !!raw.cover,
    pageNumbers: raw.pageNumbers !== false,
    titleFont: allowedFonts.has(raw.titleFont) ? raw.titleFont : fallback.titleFont,
    titleSize: Math.max(28, Math.min(48, Number(raw.titleSize) || fallback.titleSize)),
    sections: sections.length ? sections : fallback.sections
  };
}

async function browserAIPlan(context) {
  if (!("LanguageModel" in globalThis)) return null;
  const options = {
    expectedInputs: [{ type: "text", languages: ["es"] }],
    expectedOutputs: [{ type: "text", languages: ["es"] }]
  };
  let availability;
  try { availability = await LanguageModel.availability(options); } catch { return null; }
  if (availability === "unavailable") return null;
  setState(availability === "available" ? "Analizando con IA local…" : "Preparando el modelo de IA local…", "", true);
  const session = await LanguageModel.create({
    ...options,
    monitor(monitor) {
      monitor.addEventListener("downloadprogress", event => {
        const pct = Math.max(0, Math.min(100, Math.round(Number(event.loaded || 0) * 100)));
        setState(`Descargando modelo local… ${pct}%`, "", true);
      });
    }
  });
  try {
    const prompt = `Sos un director de maquetación académica. Tu única tarea es diseñar la estructura visual de un trabajo universitario.\n\nREGLAS INNEGOCIABLES:\n- NO resuelvas la tarea.\n- NO redactes párrafos, respuestas, explicaciones, conclusiones ni contenido académico.\n- NO completes datos faltantes.\n- Devolvé solamente decisiones de formato y nombres breves de secciones.\n- Los cuerpos de las secciones quedarán vacíos para que los alumnos escriban.\n- Si la consigna pide portada o carátula, marcá cover=true.\n- Si menciona páginas/hojas/numeración, activá pageNumbers; si no dice nada, preferí numerarlas.\n- Elegí como máximo 6 secciones.\n\nDATOS DE LA TAREA:\nMateria: ${context.subject || "No indicada"}\nTítulo: ${context.title || "No indicado"}\nProfesor/a: ${context.professor || "No indicado"}\nTipo: ${context.workType === "individual" ? "Individual" : "Grupal"}\nIntegrantes actuales: ${context.participantCount}\n\nINDICACIONES DEL PROFESOR:\n${context.directives || "Sin indicaciones adicionales."}\n\nGenerá únicamente el plan de maquetación.`;
    const output = await session.prompt(prompt, { responseConstraint: PLAN_SCHEMA });
    return JSON.parse(output);
  } finally {
    try { session.destroy(); } catch {}
  }
}

async function analyze() {
  if (finalized()) return;
  const button = $("#aiAnalyzeV26");
  if (button) button.disabled = true;
  const context = taskContext();
  try {
    let raw = null;
    try { raw = await browserAIPlan(context); } catch (error) { console.warn("UCOM IA local:", error); }
    if (raw) {
      currentPlan = normalizePlan(raw, context);
      setState("Plan generado por IA local. Revisalo y aplicalo cuando quieras.", "success");
    } else {
      currentPlan = fallbackPlan(context);
      setState("IA local no disponible en este dispositivo. Preparé una estructura automática sin inventar contenido.", "");
    }
    renderPlan(currentPlan);
  } catch (error) {
    currentPlan = fallbackPlan(context);
    renderPlan(currentPlan);
    setState(error.message || "No se pudo usar la IA. Preparé una estructura automática.", "error");
  } finally {
    if (button) button.disabled = false;
  }
}

function renderPlan(plan) {
  if (!plan) return;
  $("#aiPlanV26")?.classList.remove("hidden");
  $("#aiApplyV26")?.classList.remove("hidden");
  $("#aiStyleV26").value = plan.style;
  $("#aiCoverV26").checked = !!plan.cover;
  $("#aiPagesV26").checked = !!plan.pageNumbers;
  $("#aiTitleFontV26").value = plan.titleFont;
  const list = $("#aiSectionsV26");
  if (list) {
    list.replaceChildren(...plan.sections.map((section, index) => {
      const row = document.createElement("div");
      row.className = "ai-section-row-v26";
      const type = document.createElement("strong"); type.textContent = section.type;
      const title = document.createElement("span"); title.textContent = section.title || section.label;
      const meta = document.createElement("em"); meta.textContent = `${section.height}px`;
      row.append(type, title, meta);
      return row;
    }));
  }
}

function syncPlanControls() {
  if (!currentPlan) return;
  currentPlan = {
    ...currentPlan,
    style: $("#aiStyleV26")?.value || currentPlan.style,
    cover: !!$("#aiCoverV26")?.checked,
    pageNumbers: !!$("#aiPagesV26")?.checked,
    titleFont: $("#aiTitleFontV26")?.value || currentPlan.titleFont
  };
}

function sortedBlocks() {
  if (!yBlocks) return [];
  return [...yBlocks.entries()].filter(([, value]) => value instanceof Y.Map).sort((a, b) => Number(a[1].get("position") || 0) - Number(b[1].get("position") || 0));
}

function neutralDefault(value = "") {
  return /^(consigna|desarrollo|respuesta|ejercicio|texto|fórmula|formula|nota|contenido)$/i.test(String(value).trim());
}

function applyPlanToDocument(plan) {
  if (!ydoc || !yBlocks || !yLayout || !yStyles || !yConfig || finalized()) throw new Error("El documento todavía no está listo");
  const existing = sortedBlocks();
  const startY = plan.cover ? 82 : 318;
  let cursorY = startY;
  ydoc.transact(() => {
    yConfig.set("cover", !!plan.cover);
    yConfig.set("pageNumbers", !!plan.pageNumbers);
    yConfig.set("style", plan.style);
    yConfig.set("titleFont", plan.titleFont);
    yConfig.set("titleSize", plan.titleSize);
    yConfig.set("updated", Date.now());

    const oldTitleStyle = yStyles.get("meta:title");
    yStyles.set("meta:title", { ...(oldTitleStyle && typeof oldTitleStyle === "object" ? oldTitleStyle : {}), fontFamily: plan.titleFont, fontSize: plan.titleSize });
    if (plan.cover) {
      const oldMembers = yStyles.get("meta:members");
      yStyles.set("meta:members", { ...(oldMembers && typeof oldMembers === "object" ? oldMembers : {}), x: 500, y: 410, w: 236, h: Math.max(70, 34 + participants().length * 22) });
    }

    plan.sections.forEach((section, index) => {
      let entry = existing[index];
      let id, block;
      if (!entry) {
        id = crypto.randomUUID ? crypto.randomUUID() : `ai-${Date.now().toString(36)}-${index}`;
        block = new Y.Map();
        block.set("id", id);
        block.set("position", (existing.length + index) * 1000);
        block.set("type", section.type);
        block.set("accent", section.accent);
        block.set("label", new Y.Text(section.label));
        block.set("title", new Y.Text(section.title));
        block.set("body", new Y.Text(""));
        yBlocks.set(id, block);
      } else {
        [id, block] = entry;
        const body = ensureText(block, "body", "").toString().trim();
        const label = ensureText(block, "label", "");
        const title = ensureText(block, "title", "");
        if (!body) {
          block.set("type", section.type);
          block.set("accent", section.accent);
          if (!label.toString().trim() || neutralDefault(label.toString())) replaceText(label, section.label);
          if (!title.toString().trim() || neutralDefault(title.toString())) replaceText(title, section.title);
        }
      }
      const height = Math.max(70, Math.min(180, Number(section.height) || 105));
      yLayout.set(`block:${id}`, { x: 58, y: cursorY, w: 678, h: height });
      const oldStyle = yStyles.get(`block:${id}`);
      yStyles.set(`block:${id}`, { ...(oldStyle && typeof oldStyle === "object" ? oldStyle : {}), fontFamily: plan.style === "minimal" ? "georgia" : "system", fontSize: plan.style === "visual" ? 12 : 11 });
      cursorY += height + 22;
    });

    existing.slice(plan.sections.length).forEach(([id], extraIndex) => {
      const old = yLayout.get(`block:${id}`);
      if (!old || typeof old !== "object") yLayout.set(`block:${id}`, { x: 58, y: cursorY + extraIndex * 120, w: 678, h: 100 });
    });
  }, "ucom-ai-layout-v26");

  const template = $("#templateInput");
  const mapped = { institutional: "ucom", minimal: "minimal", visual: "visual", math: "math" }[plan.style] || "ucom";
  if (template && template.value !== mapped) {
    template.value = mapped;
    template.dispatchEvent(new Event("change", { bubbles: true }));
  }
  renderAll();
}

async function applyCurrentPlan() {
  if (!currentPlan || finalized()) return;
  syncPlanControls();
  try {
    applyPlanToDocument(currentPlan);
    $("#aiLayoutDialogV26")?.close();
    toast("Formato aplicado. El contenido quedó intacto.");
  } catch (error) { setState(error.message || "No se pudo aplicar el formato", "error"); }
}

function configValue(key, fallback) {
  const value = yConfig?.get(key);
  return value == null ? fallback : value;
}

function renderAll() {
  ensureUI();
  renderCover();
  renderPageNumbers();
  renderLegacyCover();
}

function renderCover() {
  const scroll = $(".preview-scroll");
  const main = $("#directPaperV23");
  if (!scroll || !main || !yConfig) return;
  const cover = !!configValue("cover", false);
  main.classList.toggle("ai-cover-active-v26", cover);
  let page = $("#aiCoverPageV26");
  if (!cover) { page?.remove(); return; }
  if (!page) {
    page = document.createElement("article");
    page.id = "aiCoverPageV26";
    page.className = "ai-cover-page-v26";
    page.innerHTML = `
      <div class="ai-cover-spectrum-v26"></div>
      <div class="ai-cover-inner-v26">
        <div class="ai-cover-brand-v26">UCOM · Universidad Comunera</div>
        <div id="aiCoverSubjectV26" class="ai-cover-subject-v26"></div>
        <div id="aiCoverTitleV26" class="ai-cover-title-v26"></div>
        <div class="ai-cover-meta-v26">
          <div><span>Profesor/a</span><strong id="aiCoverProfessorV26"></strong></div>
          <div><span>Materia</span><strong id="aiCoverSubjectMetaV26"></strong></div>
          <div class="ai-cover-members-v26"><span>Integrantes</span><div id="aiCoverMembersV26"></div></div>
        </div>
      </div>`;
    scroll.insertBefore(page, main);
    bindCoverMeta(page);
  }
  const titleFont = String(configValue("titleFont", "system"));
  const fonts = { system: 'Inter,ui-sans-serif,system-ui,sans-serif', arial:'Arial,Helvetica,sans-serif', georgia:'Georgia,"Times New Roman",serif', times:'"Times New Roman",Times,serif', verdana:'Verdana,Geneva,sans-serif', trebuchet:'"Trebuchet MS",Arial,sans-serif' };
  const title = $("#aiCoverTitleV26", page);
  if (title) { title.style.fontFamily = fonts[titleFont] || fonts.system; title.style.fontSize = `${Number(configValue("titleSize", 36)) || 36}px`; }
  syncCoverMeta(page);
  renderCoverMembers(page);
}

function bindCoverMeta(page) {
  if (page.dataset.boundV26 === "1") return;
  page.dataset.boundV26 = "1";
  [["aiCoverSubjectV26","subjectInput"],["aiCoverTitleV26","titleInput"],["aiCoverProfessorV26","professorInput"]].forEach(([coverId,inputId]) => {
    const target = $("#" + coverId, page);
    target?.addEventListener("input", () => {
      if (!adminToken() || finalized()) return;
      const input = $("#" + inputId);
      if (!input) return;
      input.value = target.innerText.replace(/\n+/g, " ").trimStart();
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });
}

function syncCoverMeta(page) {
  const admin = !!adminToken() && !finalized();
  const values = {
    aiCoverSubjectV26: $("#subjectInput")?.value || "Materia",
    aiCoverTitleV26: $("#titleInput")?.value || "Título del trabajo",
    aiCoverProfessorV26: $("#professorInput")?.value || "—",
    aiCoverSubjectMetaV26: $("#subjectInput")?.value || "—"
  };
  Object.entries(values).forEach(([id,value]) => {
    const target = $("#" + id, page);
    if (!target) return;
    if (document.activeElement !== target) target.textContent = value;
    if (["aiCoverSubjectV26","aiCoverTitleV26","aiCoverProfessorV26"].includes(id)) target.contentEditable = admin ? "true" : "false";
  });
}

function displayText(participant) {
  if (!yDisplayNames || !ydoc) return null;
  let value = yDisplayNames.get(participant.id);
  if (value instanceof Y.Text) return value;
  const text = new Y.Text(value == null ? String(participant.name || "Integrante") : String(value));
  ydoc.transact(() => yDisplayNames.set(participant.id, text), "ucom-ai-display-v26");
  return text;
}

function bindMemberLine(line, ytext) {
  if (line._v26Text === ytext) return;
  line._v26Unbind?.();
  line._v26Text = ytext;
  line.textContent = ytext.toString();
  const input = () => {
    if (finalized()) return;
    const before = ytext.toString();
    const after = line.innerText.replace(/\n+/g, " ").trimStart();
    if (before !== after) ydoc.transact(() => diffText(ytext, before, after), "ucom-ai-member-display-v26");
  };
  const remote = () => { if (document.activeElement !== line && line.innerText !== ytext.toString()) line.textContent = ytext.toString(); };
  line.addEventListener("input", input);
  ytext.observe(remote);
  line._v26Unbind = () => { line.removeEventListener("input", input); try { ytext.unobserve(remote); } catch {} };
}

function renderCoverMembers(page) {
  const host = $("#aiCoverMembersV26", page);
  if (!host) return;
  const current = participants();
  const wanted = new Set(current.map(item => item.id));
  host.querySelectorAll("[data-participant-id]").forEach(line => { if (!wanted.has(line.dataset.participantId)) { line._v26Unbind?.(); line.remove(); } });
  current.forEach(participant => {
    let line = host.querySelector(`[data-participant-id="${CSS.escape(participant.id)}"]`);
    if (!line) { line = document.createElement("div"); line.className = "ai-cover-member-v26"; line.dataset.participantId = participant.id; host.appendChild(line); }
    line.contentEditable = finalized() ? "false" : "true";
    line.spellcheck = false;
    const text = displayText(participant);
    if (text) bindMemberLine(line, text);
  });
}

function renderPageNumbers() {
  const main = $("#directPaperV23");
  if (!main || !yConfig) return;
  const enabled = !!configValue("pageNumbers", true);
  const cover = !!configValue("cover", false);
  let number = $("#aiMainPageNumberV26", main);
  if (!enabled) { number?.remove(); $("#aiCoverPageNumberV26")?.remove(); return; }
  if (!number) { number = document.createElement("div"); number.id = "aiMainPageNumberV26"; number.className = "ai-page-number-v26"; main.appendChild(number); }
  number.textContent = String(cover ? 2 : 1);
  const coverPage = $("#aiCoverPageV26");
  if (coverPage) {
    let c = $("#aiCoverPageNumberV26", coverPage);
    if (!c) { c = document.createElement("div"); c.id = "aiCoverPageNumberV26"; c.className = "ai-page-number-v26"; coverPage.appendChild(c); }
    c.textContent = "1";
  }
}

function renderLegacyCover() {
  if (syncingLegacy) return;
  const root = $("#previewPaper");
  if (!root || !yConfig) return;
  syncingLegacy = true;
  try {
    root.querySelector(".ai-cover-export-v26")?.remove();
    root.querySelector(".ai-export-content-page-v26")?.remove();
    const cover = !!configValue("cover", false);
    const pages = !!configValue("pageNumbers", true);
    root.classList.toggle("ai-export-cover-active-v26", cover);
    if (cover) {
      const section = document.createElement("section");
      section.className = "ai-cover-export-v26";
      const memberNames = participants().map(participant => displayText(participant)?.toString() || participant.name || "Integrante");
      section.innerHTML = `<div class="ai-export-brand-v26">UCOM · Universidad Comunera</div><div class="ai-export-subject-v26"></div><div class="ai-export-title-v26"></div><div class="ai-export-meta-v26"><div><strong>Profesor/a:</strong> <span></span></div><div><strong>Integrantes:</strong><div></div></div></div>${pages ? '<div class="ai-export-page-v26">1</div>' : ''}`;
      $(".ai-export-subject-v26", section).textContent = $("#subjectInput")?.value || "";
      $(".ai-export-title-v26", section).textContent = $("#titleInput")?.value || "";
      $(".ai-export-meta-v26 span", section).textContent = $("#professorInput")?.value || "";
      const memberHost = $(".ai-export-meta-v26 div div", section);
      if (memberHost) memberHost.innerHTML = memberNames.map(name => `<div>${escapeHtml(name)}</div>`).join("");
      root.prepend(section);
    }
    if (pages) {
      const footer = document.createElement("div");
      footer.className = "ai-export-content-page-v26";
      footer.textContent = String(cover ? 2 : 1);
      root.appendChild(footer);
    }
  } finally { syncingLegacy = false; }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
}

function bindMetaEvents() {
  if (metaBound) return;
  metaBound = true;
  ["subjectInput","titleInput","professorInput","directivesInput"].forEach(id => $("#" + id)?.addEventListener("input", () => setTimeout(renderAll, 20)));
}

function observeLegacy() {
  const root = $("#previewPaper");
  if (!root || legacyObserver) return;
  legacyObserver = new MutationObserver(() => { if (!syncingLegacy) setTimeout(renderLegacyCover, 30); });
  legacyObserver.observe(root, { childList: true, subtree: false });
}

function connect(id) {
  destroy();
  const auth = token(id);
  if (!id || !auth) return;
  currentProject = id;
  ydoc = new Y.Doc();
  yBlocks = ydoc.getMap("blocks");
  yLayout = ydoc.getMap("layout-v23");
  yStyles = ydoc.getMap("paper-style-v24");
  yDisplayNames = ydoc.getMap("participant-display-v24");
  yConfig = ydoc.getMap("ai-layout-v26");
  provider = new WebsocketProvider(WS, id, ydoc, { params: { token: auth } });
  provider.on("sync", synced => { if (synced) renderAll(); });
  yConfig.observeDeep(renderAll);
  yStyles.observeDeep(renderAll);
  yDisplayNames.observeDeep(renderAll);
  yBlocks.observeDeep(() => renderLegacyCover());
  clearInterval(participantTimer);
  participantTimer = setInterval(renderAll, 1800);
  bindMetaEvents();
  observeLegacy();
  ensureUI();
}

function destroy() {
  clearInterval(participantTimer);
  try { provider?.destroy(); } catch {}
  try { ydoc?.destroy(); } catch {}
  provider = null; ydoc = null; yBlocks = null; yLayout = null; yStyles = null; yDisplayNames = null; yConfig = null;
  currentProject = ""; currentPlan = null;
  $("#aiCoverPageV26")?.remove();
  $("#directPaperV23")?.classList.remove("ai-cover-active-v26");
}

function routeSync() {
  const id = projectId();
  if (!id) { if (currentProject) destroy(); return; }
  if (id === currentProject && provider) { ensureUI(); return; }
  setTimeout(() => connect(id), 1150);
}

function init() {
  window.addEventListener("hashchange", routeSync);
  window.addEventListener("ucom:lifecycle-v18", () => setTimeout(renderAll, 30));
  setTimeout(routeSync, 1300);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
