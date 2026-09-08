(() => {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  let currentPlan = null;
  let source = "";

  const PLAN_SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
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
            accent: { type: "string", enum: ["auto", "purple", "green", "yellow", "blue", "orange"] }
          },
          required: ["type", "label", "title", "accent"]
        }
      }
    },
    required: ["titleFont", "titleSize", "sections"]
  };

  function context() {
    return {
      subject: String($("#subjectInput")?.value || "").trim(),
      title: String($("#titleInput")?.value || "").trim(),
      professor: String($("#professorInput")?.value || "").trim(),
      directives: String($("#directivesInput")?.value || "").trim().slice(0, 7000),
      workType: String($("#workTypeInput")?.value || "group")
    };
  }

  function fallbackPlan(ctx) {
    const text = `${ctx.subject}\n${ctx.title}\n${ctx.directives}`.toLocaleLowerCase();
    const candidates = [
      ["Objetivos", /objetiv/], ["Introducción", /introducci/], ["Marco teórico", /marco te[oó]rico/],
      ["Metodología", /metodolog/], ["Análisis", /an[aá]lisis/], ["Desarrollo", /desarroll/],
      ["Ejercicios", /ejercicio|problema/], ["Resultados", /resultado/], ["Conclusión", /conclusi/],
      ["Bibliografía", /bibliograf|referencia/]
    ];
    const found = candidates.filter(([, re]) => re.test(text)).map(([label]) => label);
    const labels = found.length ? found.slice(0, 6) : ["Consigna", "Desarrollo", "Conclusión"];
    const accents = ["purple", "green", "blue", "orange", "yellow", "purple"];
    return {
      titleFont: /monograf|ensayo|informe|investig/.test(text) ? "georgia" : "system",
      titleSize: /visual|infograf|presentaci/.test(text) ? 42 : 36,
      sections: labels.map((label, i) => ({
        type: /ejercicio|problema/i.test(label) ? "ejercicio" : /consigna/i.test(label) ? "consigna" : /desarrollo|análisis/i.test(label) ? "desarrollo" : "texto",
        label,
        title: label,
        accent: accents[i % accents.length]
      }))
    };
  }

  function normalizePlan(raw, ctx) {
    const fallback = fallbackPlan(ctx);
    if (!raw || typeof raw !== "object") return fallback;
    const types = new Set(["consigna","desarrollo","respuesta","ejercicio","texto","formula","nota"]);
    const accents = new Set(["auto","purple","green","yellow","blue","orange"]);
    const fonts = new Set(["system","arial","georgia","times","verdana","trebuchet"]);
    const sections = Array.isArray(raw.sections) ? raw.sections.slice(0, 6).map((s, i) => ({
      type: types.has(s?.type) ? s.type : "texto",
      label: String(s?.label || s?.title || `Sección ${i + 1}`).slice(0, 40),
      title: String(s?.title || s?.label || `Sección ${i + 1}`).slice(0, 80),
      accent: accents.has(s?.accent) ? s.accent : "auto"
    })) : [];
    return {
      titleFont: fonts.has(raw.titleFont) ? raw.titleFont : fallback.titleFont,
      titleSize: Math.max(28, Math.min(48, Number(raw.titleSize) || fallback.titleSize)),
      sections: sections.length ? sections : fallback.sections
    };
  }

  function ensureDialog() {
    let d = $("#aiLocalDialogV28");
    if (d) return d;
    d = document.createElement("dialog");
    d.id = "aiLocalDialogV28";
    d.className = "ai-layout-dialog-v26";
    d.innerHTML = `
      <div class="ai-layout-card-v26">
        <div class="ai-layout-head-v26">
          <div><span class="ai-badge-v26"><i></i> Maquetación</span><h2>Diseñar con IA</h2><p>Analiza la consigna y propone estructura visual. No resuelve el trabajo.</p></div>
          <button id="aiCloseV28" class="icon-btn" type="button">×</button>
        </div>
        <div class="ai-source-v26"><strong>Indicaciones del profesor</strong><div id="aiSourceV28"></div></div>
        <div id="aiStateV28" class="ai-state-v26">Listo para analizar.</div>
        <div id="aiPlanV28" class="ai-plan-v26 hidden"><div id="aiSectionsV28" class="ai-sections-v26"></div></div>
        <div class="ai-actions-v26"><button id="aiAnalyzeV28" class="ghost" type="button">Analizar</button><button id="aiApplyV28" class="primary hidden" type="button">Aplicar formato</button></div>
      </div>`;
    document.body.appendChild(d);
    $("#aiCloseV28")?.addEventListener("click", () => d.close());
    $("#aiAnalyzeV28")?.addEventListener("click", analyze);
    $("#aiApplyV28")?.addEventListener("click", applyPlan);
    return d;
  }

  function setState(message, kind = "", spinning = false) {
    const box = $("#aiStateV28");
    if (!box) return;
    box.className = `ai-state-v26${kind ? ` ${kind}` : ""}`;
    box.replaceChildren();
    if (spinning) { const i = document.createElement("i"); i.className = "ai-spinner-v26"; box.appendChild(i); }
    box.append(document.createTextNode(message));
  }

  function renderPlan(plan) {
    $("#aiPlanV28")?.classList.remove("hidden");
    $("#aiApplyV28")?.classList.remove("hidden");
    const list = $("#aiSectionsV28");
    if (!list) return;
    list.replaceChildren(...plan.sections.map(section => {
      const row = document.createElement("div");
      row.className = "ai-section-row-v26";
      const type = document.createElement("strong"); type.textContent = section.type;
      const title = document.createElement("span"); title.textContent = section.title;
      const meta = document.createElement("em"); meta.textContent = section.accent;
      row.append(type, title, meta);
      return row;
    }));
  }

  async function browserPlan(ctx) {
    if (!("LanguageModel" in globalThis)) return null;
    const options = { expectedInputs: [{ type: "text", languages: ["es"] }], expectedOutputs: [{ type: "text", languages: ["es"] }] };
    let availability;
    try { availability = await LanguageModel.availability(options); } catch { return null; }
    if (availability === "unavailable") return null;
    setState(availability === "available" ? "Analizando con IA local…" : "Preparando IA local…", "", true);
    const session = await LanguageModel.create({
      ...options,
      monitor(monitor) {
        monitor.addEventListener("downloadprogress", event => {
          const pct = Math.round(Math.max(0, Math.min(1, Number(event.loaded || 0))) * 100);
          setState(`Descargando modelo local… ${pct}%`, "", true);
        });
      }
    });
    try {
      const prompt = `Sos un director de maquetación académica. Diseñá únicamente la estructura visual de un trabajo universitario. NO resuelvas la tarea, NO redactes contenido académico y NO inventes respuestas. Devolvé sólo nombres breves de secciones, tipo de bloque, color y tipografía del título. Máximo 6 secciones.\n\nMateria: ${ctx.subject || "No indicada"}\nTítulo: ${ctx.title || "No indicado"}\nProfesor/a: ${ctx.professor || "No indicado"}\nTipo: ${ctx.workType === "individual" ? "Individual" : "Grupal"}\n\nConsigna:\n${ctx.directives || "Sin indicaciones adicionales."}`;
      const output = await session.prompt(prompt, { responseConstraint: PLAN_SCHEMA });
      return JSON.parse(output);
    } finally {
      try { session.destroy(); } catch {}
    }
  }

  async function analyze() {
    const button = $("#aiAnalyzeV28");
    if (button) button.disabled = true;
    const ctx = context();
    try {
      let raw = null;
      try { raw = await browserPlan(ctx); } catch (error) { console.warn("UCOM IA local", error); }
      if (raw) {
        source = "ai";
        currentPlan = normalizePlan(raw, ctx);
        setState("Plan generado por IA local. Revisalo antes de aplicar.", "success");
      } else {
        source = "fallback";
        currentPlan = fallbackPlan(ctx);
        setState("IA local no disponible en este navegador. Preparé un formato automático, no una respuesta de IA.", "");
      }
      renderPlan(currentPlan);
    } catch (error) {
      source = "fallback";
      currentPlan = fallbackPlan(ctx);
      renderPlan(currentPlan);
      setState(error.message || "No se pudo usar la IA local; preparé un formato automático.", "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function setEditableText(element, value) {
    if (!element) return;
    element.focus();
    element.textContent = value;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    element.blur();
  }

  async function applyPlan() {
    if (!currentPlan) return;
    const api = window.UCOMDirectCanvasV23;
    if (!api?.getState) { setState("El editor todavía no está listo.", "error"); return; }
    const state = api.getState();
    const existing = [...(state.blocks || [])];

    api.select?.("meta:title");
    const font = $("#fontFamilyV24"), size = $("#fontSizeV24");
    if (font) { font.value = currentPlan.titleFont; font.dispatchEvent(new Event("change", { bubbles: true })); }
    if (size) { size.value = String(currentPlan.titleSize); size.dispatchEvent(new Event("change", { bubbles: true })); }

    for (let index = 0; index < currentPlan.sections.length; index++) {
      const section = currentPlan.sections[index];
      let block = existing[index];
      if (!block || String(block.body || "").trim()) {
        const before = new Set((api.getState().blocks || []).map(item => item.id));
        const type = $("#canvasAddTypeV23");
        if (type) type.value = section.type;
        $("#canvasAddV23")?.click();
        await new Promise(resolve => setTimeout(resolve, 45));
        block = (api.getState().blocks || []).find(item => !before.has(item.id));
      }
      if (!block) continue;
      api.select?.(`block:${block.id}`);
      await new Promise(resolve => setTimeout(resolve, 15));
      const typeSelect = $("#canvasSelectedTypeV23");
      if (typeSelect) { typeSelect.value = section.type; typeSelect.dispatchEvent(new Event("change", { bubbles: true })); }
      const element = document.querySelector(`#directPaperV23 [data-block-id="${CSS.escape(block.id)}"]`);
      setEditableText(element?.querySelector(".direct-block-label-v23"), section.label);
      setEditableText(element?.querySelector(".direct-block-title-v23"), section.title);
      document.querySelector(`#canvasAccentV23 [data-accent="${CSS.escape(section.accent)}"]`)?.click();
    }

    setState(source === "ai" ? "Formato de IA aplicado al documento." : "Formato automático aplicado al documento.", "success");
    setTimeout(() => $("#aiLocalDialogV28")?.close(), 850);
  }

  function open() {
    const dialog = ensureDialog();
    currentPlan = null;
    source = "";
    $("#aiSourceV28").textContent = context().directives || "Sin consigna cargada.";
    $("#aiPlanV28")?.classList.add("hidden");
    $("#aiApplyV28")?.classList.add("hidden");
    setState("Listo para analizar.");
    dialog.showModal();
  }

  document.addEventListener("click", event => {
    if (event.target?.closest?.("#aiLayoutV26")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      open();
    }
  }, true);
})();
