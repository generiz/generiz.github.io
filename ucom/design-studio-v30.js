(() => {
  "use strict";

  const API = "https://ucom-api.ufotech.com.py";
  const ADMIN_KEY = "ucom.admin.session.v2";
  const GOOGLE_KEY = "ucom.google.session.v11";
  const $ = (s, root = document) => root.querySelector(s);
  const PRESETS = [
    ["spectrum", "Spectrum", "UCOM, limpio y con identidad"],
    ["editorial", "Editorial", "Serif, portada de revista académica"],
    ["minimal", "Minimal", "Mucho aire y jerarquía sobria"],
    ["campus", "Campus", "Institucional, fuerte y universitario"],
    ["modern", "Modern", "Geométrico y contemporáneo"],
    ["notebook", "Notebook", "Académico, cálido y estructurado"],
    ["mono", "Mono", "Técnico, preciso y de alto contraste"],
    ["classic", "Clásico", "Formal, centrado y tradicional"],
  ];
  const PRESET_IDS = PRESETS.map(([id]) => id);
  const AI_SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
      preset: { type: "string", enum: PRESET_IDS },
      cover: { type: "boolean" }
    },
    required: ["preset", "cover"]
  };

  let currentProject = "";
  let current = { preset: "spectrum", cover: false, year: String(new Date().getFullYear()), show_year: true };
  let updatedAt = "";
  let pollTimer = 0;
  let coverTimer = 0;
  let saveTimer = 0;
  let saving = false;

  const projectId = () => {
    const m = location.hash.match(/^#\/p\/([^/]+)\/?$/);
    return m ? decodeURIComponent(m[1]) : "";
  };
  const token = id => sessionStorage.getItem(ADMIN_KEY) || sessionStorage.getItem(`ucom.participant.${id}`) || localStorage.getItem(GOOGLE_KEY) || "";
  const finalized = () => $("#workspace")?.classList.contains("task-finalized-v18") || false;
  const isAdmin = () => !!sessionStorage.getItem(ADMIN_KEY);

  function request(method, path, body) {
    const id = projectId();
    const auth = token(id);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, `${API}${path}`, true);
      xhr.setRequestHeader("Accept", "application/json");
      if (body !== undefined) xhr.setRequestHeader("Content-Type", "application/json");
      if (auth) xhr.setRequestHeader("Authorization", `Bearer ${auth}`);
      xhr.timeout = 9000;
      xhr.onreadystatechange = () => {
        if (xhr.readyState !== 4) return;
        let data = {};
        try { data = xhr.responseText ? JSON.parse(xhr.responseText) : {}; } catch {}
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || `HTTP ${xhr.status || 0}`));
      };
      xhr.onerror = () => reject(new Error("No se pudo conectar con el servidor"));
      xhr.ontimeout = () => reject(new Error("El servidor tardó demasiado"));
      xhr.send(body === undefined ? null : JSON.stringify(body));
    });
  }

  function toast(message, error = false) {
    const box = $("#toast");
    if (!box) return;
    box.textContent = message;
    box.className = `toast show ${error ? "error" : ""}`;
    setTimeout(() => { if (box.textContent === message) box.className = "toast"; }, 3300);
  }

  function ensureButton() {
    const actions = $(".workspace-actions");
    if (!actions) return;
    const link = $("a.design-link", actions);
    if (link) {
      link.href = "#";
      link.textContent = "Diseño";
      if (link.dataset.v30 !== "1") {
        link.dataset.v30 = "1";
        link.addEventListener("click", event => { event.preventDefault(); openStudio(); });
      }
    }
  }

  function ensureDialog() {
    let dialog = $("#designStudioV29");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "designStudioV29";
    dialog.className = "design-studio-v29";
    dialog.innerHTML = `
      <div class="design-shell-v29">
        <header class="design-head-v29">
          <div><span>Documento</span><h2>Estudio de diseño</h2></div>
          <button class="icon-btn" id="designCloseV29" type="button">×</button>
        </header>
        <section class="design-cover-settings-v29">
          <label class="design-toggle-v29"><input id="designCoverV29" type="checkbox"><span></span><strong>Portada</strong></label>
          <label class="design-year-v29">Año<input id="designYearV29" inputmode="numeric" maxlength="4"></label>
          <label class="design-check-v29"><input id="designShowYearV29" type="checkbox"> Mostrar año</label>
          <button id="designAiV29" class="ghost design-ai-v29" type="button">✦ Sugerir con IA</button>
        </section>
        <section id="designGalleryV29" class="design-gallery-v29"></section>
        <footer class="design-footer-v29"><span>El diseño se comparte con todo el grupo.</span><button id="designDoneV29" class="primary" type="button">Listo</button></footer>
      </div>`;
    document.body.appendChild(dialog);
    const gallery = $("#designGalleryV29", dialog);
    gallery.replaceChildren(...PRESETS.map(([id, name, desc]) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "design-card-v29";
      card.dataset.preset = id;
      card.innerHTML = `<div class="design-thumb-v29 thumb-${id}"><i></i><b></b><span></span><em></em></div><div><strong>${name}</strong><span>${desc}</span></div>`;
      card.addEventListener("click", () => setState({ ...current, preset: id }, true));
      return card;
    }));
    $("#designCloseV29", dialog).addEventListener("click", () => dialog.close());
    $("#designDoneV29", dialog).addEventListener("click", () => dialog.close());
    $("#designCoverV29", dialog).addEventListener("change", event => setState({ ...current, cover: !!event.target.checked }, true));
    $("#designShowYearV29", dialog).addEventListener("change", event => setState({ ...current, show_year: !!event.target.checked }, true));
    $("#designYearV29", dialog).addEventListener("input", event => {
      event.target.value = event.target.value.replace(/\D/g, "").slice(0, 4);
      if (event.target.value.length === 4) setState({ ...current, year: event.target.value }, true);
    });
    $("#designAiV29", dialog).addEventListener("click", suggestWithAI);
    return dialog;
  }

  function openStudio() {
    const dialog = ensureDialog();
    syncDialog();
    dialog.showModal();
  }

  function syncDialog() {
    const dialog = ensureDialog();
    $("#designCoverV29", dialog).checked = !!current.cover;
    $("#designYearV29", dialog).value = current.year || String(new Date().getFullYear());
    $("#designShowYearV29", dialog).checked = current.show_year !== false;
    dialog.querySelectorAll("[data-preset]").forEach(card => card.classList.toggle("active", card.dataset.preset === current.preset));
  }

  function setState(next, persist = false) {
    current = {
      preset: PRESET_IDS.includes(next.preset) ? next.preset : "spectrum",
      cover: !!next.cover,
      year: /^\d{4}$/.test(String(next.year || "")) ? String(next.year) : String(new Date().getFullYear()),
      show_year: next.show_year !== false,
    };
    applyDesign();
    syncDialog();
    if (persist && !finalized()) scheduleSave();
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 170);
  }

  async function save() {
    const id = projectId();
    if (!id || !token(id) || saving) return;
    saving = true;
    try {
      const data = await request("PUT", `/api/projects/${encodeURIComponent(id)}/design-v29`, { state: current });
      if (data.state) current = data.state;
      updatedAt = data.updated_at || updatedAt;
      applyDesign();
    } catch (error) {
      toast(error.message || "No se pudo guardar el diseño", true);
    } finally {
      saving = false;
    }
  }

  async function load(force = false) {
    const id = projectId();
    if (!id || !token(id)) return;
    if (!force && id === currentProject && saving) return;
    try {
      const data = await request("GET", `/api/projects/${encodeURIComponent(id)}/design-v29`);
      currentProject = id;
      if (!updatedAt || data.updated_at !== updatedAt) {
        updatedAt = data.updated_at || "";
        setState(data.state || current, false);
      }
    } catch (error) {
      if (force) console.warn("UCOM diseño V30", error);
    }
  }

  function contextText() {
    return `${$("#subjectInput")?.value || ""}\n${$("#titleInput")?.value || ""}\n${$("#directivesInput")?.value || ""}`.trim();
  }

  function fallbackSuggestion() {
    const text = contextText().toLocaleLowerCase();
    let preset = "spectrum";
    if (/monograf|ensayo|literat|historia|humanidad/.test(text)) preset = "editorial";
    else if (/formal|investig|informe|bibliograf|marco te[oó]rico/.test(text)) preset = "classic";
    else if (/matem|program|c[oó]digo|sistema|tecnolog|ingenier/.test(text)) preset = "mono";
    else if (/infograf|visual|creativ|marketing|diseño|innov/.test(text)) preset = "modern";
    else if (/actividad|apunte|clase|ejercicio|cuestionario/.test(text)) preset = "notebook";
    else if (/institucional|universidad|facultad|ucom/.test(text)) preset = "campus";
    else if (/minimal|sobrio|simple/.test(text)) preset = "minimal";
    const cover = /portada|car[aá]tula|presentaci[oó]n formal|monograf|informe final|trabajo final/.test(text);
    return { preset, cover };
  }

  async function aiSuggestion() {
    if (!("LanguageModel" in globalThis)) return null;
    const options = { expectedInputs: [{ type: "text", languages: ["es"] }], expectedOutputs: [{ type: "text", languages: ["es"] }] };
    let availability;
    try { availability = await LanguageModel.availability(options); } catch { return null; }
    if (availability === "unavailable") return null;
    const session = await LanguageModel.create(options);
    try {
      const prompt = `Elegí la dirección de arte para un trabajo universitario. No escribas contenido. Devolvé solamente preset y si conviene portada.\n\nPresets disponibles:\n- spectrum: identidad UCOM contemporánea\n- editorial: serif, revista académica\n- minimal: sobrio y con mucho aire\n- campus: institucional universitario\n- modern: visual, geométrico, creativo\n- notebook: actividades y ejercicios\n- mono: técnico, ingeniería, programación o matemática\n- classic: informe formal o investigación tradicional\n\nUsá portada sólo si la consigna la pide o si por el tipo de entrega claramente corresponde.\n\nTarea:\n${contextText() || "Sin consigna"}`;
      const output = await session.prompt(prompt, { responseConstraint: AI_SCHEMA });
      return JSON.parse(output);
    } finally {
      try { session.destroy(); } catch {}
    }
  }

  async function suggestWithAI() {
    const button = $("#designAiV29");
    if (!button || finalized()) return;
    button.disabled = true;
    button.textContent = "Analizando…";
    try {
      let suggestion = null;
      try { suggestion = await aiSuggestion(); } catch (error) { console.warn("UCOM IA diseño", error); }
      const usedAI = !!suggestion;
      suggestion = suggestion && PRESET_IDS.includes(suggestion.preset) ? suggestion : fallbackSuggestion();
      setState({ ...current, preset: suggestion.preset, cover: !!suggestion.cover }, true);
      const name = PRESETS.find(([id]) => id === suggestion.preset)?.[1] || suggestion.preset;
      toast(usedAI ? `IA: ${name}${suggestion.cover ? " + portada" : ""}` : `Sugerencia automática: ${name}${suggestion.cover ? " + portada" : ""}`);
    } finally {
      button.disabled = false;
      button.textContent = "✦ Sugerir con IA";
    }
  }

  function participantNames() {
    const visible = [...document.querySelectorAll("#directPaperV23 .participant-display-name-v24")].map(el => el.innerText.trim()).filter(Boolean);
    if (visible.length) return visible;
    return (window.UCOMDirectCanvasV23?.getState?.().participants || []).map(item => item.name).filter(Boolean);
  }

  function dueText() {
    const raw = $("#dueDateInput")?.value || "";
    if (!raw) return "";
    try { return new Date(raw).toLocaleDateString("es-PY", { day: "2-digit", month: "long", year: "numeric" }); }
    catch { return raw; }
  }

  function ensureCover() {
    const scroll = $(".preview-scroll");
    const paper = $("#directPaperV23");
    if (!scroll || !paper) return null;
    let cover = $("#designCoverPageV29");
    if (!current.cover) {
      cover?.remove();
      paper.classList.remove("with-cover-v29");
      return null;
    }
    if (!cover) {
      cover = document.createElement("article");
      cover.id = "designCoverPageV29";
      cover.className = "design-cover-page-v29";
      cover.innerHTML = `
        <div class="cover-decoration-v29"><i></i><i></i><i></i></div>
        <div class="cover-content-v29">
          <div class="cover-brand-v29"><span class="cover-u-v29">U</span><div><strong>UCOM</strong><small>Universidad Comunera</small></div></div>
          <div class="cover-main-v29"><div id="coverSubjectV29" class="cover-subject-v29"></div><span class="cover-task-label-v29">Tarea</span><div id="coverTitleV29" class="cover-title-v29"></div></div>
          <div class="cover-meta-v29">
            <div class="cover-meta-item-v29"><span>Profesor/a</span><strong id="coverProfessorV29"></strong></div>
            <div class="cover-meta-item-v29 cover-year-item-v29"><span>Año</span><strong id="coverYearV29"></strong></div>
            <div class="cover-meta-item-v29 cover-due-item-v29"><span>Entrega</span><strong id="coverDueV29"></strong></div>
            <div class="cover-meta-item-v29 cover-members-item-v29"><span id="coverMembersLabelV29">Integrantes</span><div id="coverMembersV29"></div></div>
          </div>
          <div class="cover-footer-v29">UCOM · Documento académico</div>
        </div>`;
      scroll.insertBefore(cover, paper);
      bindCoverEditing(cover);
    }
    paper.classList.add("with-cover-v29");
    return cover;
  }

  function bindCoverEditing(cover) {
    [["coverSubjectV29", "subjectInput"], ["coverTitleV29", "titleInput"], ["coverProfessorV29", "professorInput"]].forEach(([coverId, inputId]) => {
      const el = $("#" + coverId, cover);
      if (!el || el.dataset.boundV30 === "1") return;
      el.dataset.boundV30 = "1";
      el.addEventListener("input", () => {
        if (!isAdmin() || finalized()) return;
        const input = $("#" + inputId);
        if (!input) return;
        input.value = el.innerText.replace(/\n+/g, " ").trimStart();
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    });
    $("#coverYearV29", cover)?.addEventListener("blur", event => {
      if (finalized()) return;
      const clean = event.currentTarget.innerText.replace(/\D/g, "").slice(0, 4);
      if (clean.length === 4) setState({ ...current, year: clean }, true);
      else event.currentTarget.textContent = current.year;
    });
  }

  function syncCover() {
    const paper = $("#directPaperV23");
    if (!paper) return;
    const cover = ensureCover();
    ["meta:subject", "meta:title", "meta:professor", "meta:due", "meta:members"].forEach(key => {
      const el = paper.querySelector(`[data-direct-key="${key}"]`);
      if (el) el.classList.toggle("design-cover-hidden-v29", !!current.cover);
    });
    if (!cover) return;
    cover.className = `design-cover-page-v29 cover-${current.preset}`;
    const values = {
      coverSubjectV29: $("#subjectInput")?.value || "Materia",
      coverTitleV29: $("#titleInput")?.value || "Título de la tarea",
      coverProfessorV29: $("#professorInput")?.value || "—",
      coverYearV29: current.year,
      coverDueV29: dueText() || "—",
    };
    Object.entries(values).forEach(([id, value]) => {
      const el = $("#" + id, cover);
      if (el && document.activeElement !== el && el.textContent !== value) el.textContent = value;
    });
    $(".cover-year-item-v29", cover)?.classList.toggle("hidden", current.show_year === false);
    ["coverSubjectV29", "coverTitleV29", "coverProfessorV29"].forEach(id => {
      const el = $("#" + id, cover);
      if (el) el.contentEditable = isAdmin() && !finalized() ? "true" : "false";
    });
    const year = $("#coverYearV29", cover);
    if (year) year.contentEditable = !finalized() ? "true" : "false";
    const names = participantNames();
    $("#coverMembersLabelV29", cover).textContent = names.length === 1 ? "Integrante" : "Integrantes";
    const host = $("#coverMembersV29", cover);
    if (!host) return;
    while (host.children.length > names.length) host.lastElementChild.remove();
    names.forEach((name, index) => {
      let line = host.children[index];
      if (!line) {
        line = document.createElement("div");
        line.className = "cover-member-v29";
        line.dataset.index = String(index);
        host.appendChild(line);
        line.addEventListener("input", () => {
          if (finalized()) return;
          const i = Number(line.dataset.index || 0);
          const main = document.querySelectorAll("#directPaperV23 .participant-display-name-v24")[i];
          if (!main) return;
          const next = line.innerText.replace(/\n+/g, " ").trimStart();
          if (main.innerText !== next) {
            main.textContent = next;
            main.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: null }));
          }
        });
      }
      line.dataset.index = String(index);
      if (document.activeElement !== line && line.textContent !== name) line.textContent = name;
      line.contentEditable = !finalized() ? "true" : "false";
    });
  }

  function applyDesign() {
    ensureButton();
    for (const root of [$("#directPaperV23"), $("#previewPaper")]) {
      if (!root) continue;
      [...root.classList].filter(c => c.startsWith("design-v29-")).forEach(c => root.classList.remove(c));
      root.classList.add(`design-v29-${current.preset}`);
    }
    syncCover();
  }

  function bindMetaInputs() {
    if (document.body.dataset.designMetaV30 === "1") return;
    document.body.dataset.designMetaV30 = "1";
    ["subjectInput", "titleInput", "professorInput", "dueDateInput"].forEach(id => $("#" + id)?.addEventListener("input", syncCover));
  }

  function route() {
    const id = projectId();
    if (!id) {
      currentProject = "";
      $("#designCoverPageV29")?.remove();
      return;
    }
    ensureButton();
    ensureDialog();
    bindMetaInputs();
    setTimeout(() => { load(true); applyDesign(); }, 350);
  }

  function init() {
    window.addEventListener("hashchange", route);
    window.addEventListener("ucom:lifecycle-v18", applyDesign);
    clearInterval(pollTimer);
    clearInterval(coverTimer);
    pollTimer = setInterval(() => { if (projectId()) load(false); }, 3000);
    coverTimer = setInterval(() => { if (projectId()) syncCover(); }, 750);
    route();
  }

  window.UCOMDesignV29 = { open: openStudio, getState: () => ({ ...current }), apply: state => setState(state, true), suggest: suggestWithAI };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();