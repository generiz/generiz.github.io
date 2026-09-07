(() => {
  "use strict";

  const API = "https://ucom-api.ufotech.com.py";
  const ADMIN_KEY = "ucom.admin.session.v2";
  const GOOGLE_KEY = "ucom.google.session.v11";
  const DESIGN_KEY = "ucom.design.selection.v1";
  const DEFAULT_DESIGN = { template:"institutional", identity:"ucom", p:"#43358b", s:"#5bc5f2", logo:true, stripe:true, members:true, footer:true };
  const $ = (s, root = document) => root.querySelector(s);
  let currentPresentation = { show_professor:true, show_due:true, show_members:true, design:{...DEFAULT_DESIGN} };
  let previewObserver = null;
  let pdfPromise = null;

  const adminToken = () => sessionStorage.getItem(ADMIN_KEY) || "";
  const googleToken = () => localStorage.getItem(GOOGLE_KEY) || "";
  const projectId = () => {
    const m = location.hash.match(/^#\/p\/([^/]+)\/?$/);
    return m ? decodeURIComponent(m[1]) : "";
  };
  const projectToken = id => adminToken() || sessionStorage.getItem(`ucom.participant.${id}`) || googleToken() || "";

  function xhr(method, path, token = "", body) {
    return new Promise((resolve, reject) => {
      const req = new XMLHttpRequest();
      req.open(method, `${API}${path}`, true);
      req.setRequestHeader("Accept", "application/json");
      if (body !== undefined) req.setRequestHeader("Content-Type", "application/json");
      if (token) req.setRequestHeader("Authorization", `Bearer ${token}`);
      req.onreadystatechange = () => {
        if (req.readyState !== 4) return;
        let data = {};
        try { data = req.responseText ? JSON.parse(req.responseText) : {}; } catch { data = {}; }
        if (req.status >= 200 && req.status < 300) resolve(data);
        else reject(Object.assign(new Error(data.error || `HTTP ${req.status || 0}`), { status:req.status }));
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
    setTimeout(() => { if (el.textContent === message) el.className = "toast"; }, 3200);
  }

  function savedDesign() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DESIGN_KEY) || "null");
      if (parsed && typeof parsed === "object") return { ...DEFAULT_DESIGN, ...parsed };
    } catch {}
    return { ...DEFAULT_DESIGN };
  }

  function installCreateFieldControls() {
    const bottom = $("#createDialog .create-bottom-grid");
    if (!bottom || $("#createFieldsV13")) return;
    const box = document.createElement("div");
    box.id = "createFieldsV13";
    box.className = "create-fields-v13";
    box.innerHTML = `
      <span class="field-visibility-title">Campos de la tarea</span>
      <div class="field-visibility-options-v13">
        <label><input id="createShowProfessorV13" type="checkbox" checked> Profesor/a</label>
        <label><input id="createShowDueV13" type="checkbox" checked> Entrega</label>
        <label><input id="createShowMembersV13" type="checkbox" checked> Integrantes</label>
      </div>`;
    bottom.before(box);
    ["createShowProfessorV13","createShowDueV13","createShowMembersV13"].forEach(id => $("#" + id)?.addEventListener("change", syncCreateFields));
    $("#createForm")?.addEventListener("reset", () => setTimeout(() => {
      ["createShowProfessorV13","createShowDueV13","createShowMembersV13"].forEach(id => { const el = $("#" + id); if (el) el.checked = true; });
      syncCreateFields();
    }, 0));
    syncCreateFields();
  }

  function syncCreateFields() {
    const professor = $("#createShowProfessorV13")?.checked !== false;
    const due = $("#createShowDueV13")?.checked !== false;
    const professorInput = $('#createForm [name="professor"]');
    const dueInput = $("#createDueDate");
    if (professorInput?.closest("label")) professorInput.closest("label").classList.toggle("hidden", !professor);
    if (dueInput?.closest("label")) dueInput.closest("label").classList.toggle("hidden", !due);
    if (dueInput) dueInput.required = due;
  }

  function selectedCreateType() {
    return $('#createForm input[name="work_type"]:checked')?.value || "group";
  }

  function createCount() {
    return selectedCreateType() === "individual" ? 1 : Math.max(2, Math.min(30, Number($("#createMaxMembers")?.value) || 4));
  }

  function showCreateError(message) {
    const box = $("#createError");
    if (!box) return;
    box.textContent = message;
    box.classList.remove("hidden");
  }

  async function createTaskV13(event) {
    const form = $("#createForm");
    if (!form || event.target !== form) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const token = adminToken();
    if (!token) { showCreateError("Sesión de administrador requerida"); return; }
    syncCreateFields();
    if (!form.reportValidity()) return;

    const fd = new FormData(form);
    const showProfessor = $("#createShowProfessorV13")?.checked !== false;
    const showDue = $("#createShowDueV13")?.checked !== false;
    const showMembers = $("#createShowMembersV13")?.checked !== false;
    const due = showDue ? String($("#createDueDate")?.value || "").trim() : "";
    if (showDue && (!due || Number.isNaN(new Date(due).getTime()) || new Date(due).getTime() <= Date.now())) {
      showCreateError("La entrega debe ser futura");
      return;
    }

    const googleMode = $("#createGoogleMode")?.value || "all";
    const domains = $("#createAllowedDomains")?.value || "";
    const codeEnabled = $("#createCodeEnabled") ? !!$("#createCodeEnabled").checked : true;
    if (googleMode === "domains" && !domains.trim()) { showCreateError("Indicá el dominio permitido"); return; }

    const button = form.querySelector('button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = "Creando…"; }
    let id = "";
    try {
      const created = await xhr("POST", "/api/projects", token, {
        subject: String(fd.get("subject") || ""),
        title: String(fd.get("title") || ""),
        professor: showProfessor ? String(fd.get("professor") || "") : "",
        class_date: due ? due.slice(0, 10) : "",
        due_date: due,
        work_type: selectedCreateType(),
        members: [],
        directives: "",
        content: "",
        template: "ucom",
        access_mode: "24h",
      });
      id = created.project?.id || "";
      if (!id) throw new Error("No se generó la tarea");

      await xhr("PUT", `/api/projects/${encodeURIComponent(id)}/settings`, token, { project_end_at: due, max_members: createCount() });
      await xhr("PUT", `/api/projects/${encodeURIComponent(id)}/auth-policy-v11`, token, { google_mode: googleMode, allowed_domains: domains, code_enabled: codeEnabled });
      const design = savedDesign();
      design.members = showMembers;
      await xhr("PUT", `/api/projects/${encodeURIComponent(id)}/presentation-v13`, token, {
        show_professor: showProfessor,
        show_due: showDue,
        show_members: showMembers,
        design,
      });

      $("#createDialog")?.close();
      form.reset();
      location.hash = `#/p/${encodeURIComponent(id)}`;
      toast("Tarea creada");
    } catch (error) {
      if (id) xhr("DELETE", `/api/admin/projects/${encodeURIComponent(id)}`, token).catch(() => {});
      showCreateError(error.message || "No se pudo crear la tarea");
    } finally {
      if (button) { button.disabled = false; button.textContent = "Crear tarea"; }
    }
  }

  function installWorkspaceFieldControls() {
    const panel = $(".directives-panel");
    const fieldGrid = $(".directives-panel .field-grid");
    if (!panel || !fieldGrid || $("#workspaceFieldsV13")) return;
    const box = document.createElement("div");
    box.id = "workspaceFieldsV13";
    box.className = "field-visibility-v13 admin-only-field";
    box.innerHTML = `
      <span class="field-visibility-title">Mostrar en el documento</span>
      <div class="field-visibility-options-v13">
        <label><input id="showProfessorV13" type="checkbox"> Profesor/a</label>
        <label><input id="showDueV13" type="checkbox"> Entrega</label>
        <label><input id="showMembersV13" type="checkbox"> Integrantes</label>
      </div>`;
    fieldGrid.after(box);
    ["showProfessorV13","showDueV13","showMembersV13"].forEach(id => $("#" + id)?.addEventListener("change", saveVisibility));
  }

  function syncWorkspaceFieldUI() {
    const p = currentPresentation;
    const professor = $("#professorInput")?.closest("label");
    const due = $("#dueDateInput")?.closest("label");
    const members = $(".member-editor");
    professor?.classList.toggle("hidden", !p.show_professor);
    due?.classList.toggle("hidden", !p.show_due);
    members?.classList.toggle("hidden", !p.show_members);
    if ($("#showProfessorV13")) $("#showProfessorV13").checked = !!p.show_professor;
    if ($("#showDueV13")) $("#showDueV13").checked = !!p.show_due;
    if ($("#showMembersV13")) $("#showMembersV13").checked = !!p.show_members;
    $("#workspaceFieldsV13")?.classList.toggle("hidden", !adminToken());
  }

  async function saveVisibility() {
    const id = projectId();
    const token = adminToken();
    if (!id || !token) return;
    const next = {
      show_professor: !!$("#showProfessorV13")?.checked,
      show_due: !!$("#showDueV13")?.checked,
      show_members: !!$("#showMembersV13")?.checked,
      design: { ...currentPresentation.design, members: !!$("#showMembersV13")?.checked },
    };
    try {
      const data = await xhr("PUT", `/api/projects/${encodeURIComponent(id)}/presentation-v13`, token, next);
      currentPresentation = data;
      syncWorkspaceFieldUI();
      applyPresentation();
      toast("Campos actualizados");
    } catch (error) { toast(error.message || "No se pudo guardar", true); }
  }

  async function loadPresentation() {
    const id = projectId();
    const token = projectToken(id);
    if (!id || !token) return;
    try {
      const data = await xhr("GET", `/api/projects/${encodeURIComponent(id)}/presentation-v13`, token);
      currentPresentation = data;
      syncWorkspaceFieldUI();
      applyPresentation();
    } catch {}
  }

  function rowLabel(row) {
    return (row.querySelector("span")?.textContent || "").trim().toLowerCase();
  }

  function applyPresentationTo(root) {
    if (!root) return;
    const p = currentPresentation;
    const design = { ...DEFAULT_DESIGN, ...(p.design || {}) };
    root.classList.add("design-v13");
    ["design-institutional-v13","design-monograph-v13","design-activity-v13"].forEach(c => root.classList.remove(c));
    root.classList.add(`design-${design.template || "institutional"}-v13`);
    root.classList.toggle("has-spectrum-v13", !!design.stripe && design.identity === "ucom");
    root.classList.toggle("no-footer-v13", !design.footer);
    root.style.setProperty("--design-primary", design.p || DEFAULT_DESIGN.p);
    root.style.setProperty("--design-secondary", design.s || DEFAULT_DESIGN.s);

    let brand = root.querySelector(".doc-brand-v13");
    if (design.logo) {
      if (!brand) {
        brand = document.createElement("div");
        brand.className = "doc-brand-v13";
        brand.innerHTML = "<strong>UCOM</strong><span>Universidad Comunera</span>";
        root.prepend(brand);
      }
    } else brand?.remove();

    root.querySelectorAll(".doc-meta > div").forEach(row => {
      const label = rowLabel(row);
      let visible = true;
      if (label === "fecha") visible = false;
      else if (label.startsWith("profesor")) visible = !!p.show_professor;
      else if (label === "entrega") visible = !!p.show_due;
      else if (label.startsWith("integrantes")) visible = !!p.show_members;
      row.style.display = visible ? "" : "none";
    });
  }

  function applyPresentation() {
    applyPresentationTo($("#previewPaper"));
  }

  function watchPreview() {
    const preview = $("#previewPaper");
    if (!preview || previewObserver) return;
    previewObserver = new MutationObserver(() => applyPresentationTo(preview));
    previewObserver.observe(preview, { childList:true, subtree:true });
  }

  function installDesignLink() {
    const link = $(".design-link");
    if (!link || link.dataset.v13 === "1") return;
    link.dataset.v13 = "1";
    link.addEventListener("click", event => {
      const id = projectId();
      if (!id) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      location.href = `./templates/?project=${encodeURIComponent(id)}`;
    }, true);
  }

  function safeFilename(value) {
    return (value || "Tarea").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "Tarea";
  }

  function loadHtml2Pdf() {
    if (window.html2pdf) return Promise.resolve(window.html2pdf);
    if (pdfPromise) return pdfPromise;
    pdfPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.2/dist/html2pdf.bundle.min.js";
      script.onload = () => resolve(window.html2pdf);
      script.onerror = () => reject(new Error("No se pudo cargar el generador PDF"));
      document.head.appendChild(script);
    });
    return pdfPromise;
  }

  async function downloadPdf() {
    const source = $("#previewPaper");
    if (!source) return;
    const button = $("#exportBtn");
    const previous = button?.textContent || "PDF";
    if (button) { button.disabled = true; button.textContent = "Generando…"; }
    let clone;
    try {
      const html2pdf = await loadHtml2Pdf();
      clone = source.cloneNode(true);
      clone.style.width = "794px";
      clone.style.minHeight = "1123px";
      clone.style.margin = "0";
      clone.style.boxShadow = "none";
      clone.style.position = "fixed";
      clone.style.left = "-10000px";
      clone.style.top = "0";
      document.body.appendChild(clone);
      await html2pdf().set({
        margin: 0,
        filename: `${safeFilename($("#titleInput")?.value)}.pdf`,
        image: { type:"jpeg", quality:0.98 },
        html2canvas: { scale:2, useCORS:true, backgroundColor:"#ffffff" },
        jsPDF: { unit:"mm", format:"a4", orientation:"portrait" },
        pagebreak: { mode:["css","legacy"] },
      }).from(clone).save();
    } catch (error) { toast(error.message || "No se pudo generar el PDF", true); }
    finally { clone?.remove(); if (button) { button.disabled = false; button.textContent = previous; } }
  }

  function downloadDoc() {
    const source = $("#previewPaper");
    if (!source) return;
    const clone = source.cloneNode(true);
    applyPresentationTo(clone);
    clone.querySelectorAll('.doc-meta > div').forEach(row => { if (row.style.display === "none") row.remove(); });
    const design = { ...DEFAULT_DESIGN, ...(currentPresentation.design || {}) };
    const title = $("#titleInput")?.value || "Tarea";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
      @page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#17202b} .paper{max-width:174mm;margin:0 auto;line-height:1.55;position:relative}.doc-brand-v13{display:flex;justify-content:space-between;margin-bottom:26px}.doc-brand-v13 strong{color:${design.p};font-size:18px}.doc-brand-v13 span{font-size:10px;color:#777}.doc-kicker{text-transform:uppercase;font-size:10px;letter-spacing:1.5px;color:#667}.doc-title{font-size:30px;color:${design.p};margin:10px 0 22px}.doc-meta{border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:12px 0;margin-bottom:24px}.doc-meta>div{margin:6px 0}.doc-meta span{display:inline-block;width:110px;font-size:10px;text-transform:uppercase;color:#778}.doc-directives{padding:14px;background:#f4f6f8;border-left:4px solid ${design.p};margin:20px 0;white-space:pre-wrap}.doc-body{line-height:1.6}.doc-body table{width:100%;border-collapse:collapse}.doc-body th,.doc-body td{border:1px solid #ddd;padding:7px}.doc-footer{margin-top:40px;border-top:1px solid #ddd;padding-top:10px;color:#889;font-size:10px}</style></head><body>${clone.outerHTML}</body></html>`;
    const blob = new Blob([html], { type:"application/msword;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${safeFilename(title)}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  }

  function installExports() {
    const pdf = $("#exportBtn");
    if (!pdf) return;
    pdf.textContent = "PDF";
    pdf.title = "Descargar PDF";
    pdf.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      downloadPdf();
    }, true);
    if (!$("#exportDocV13")) {
      const doc = document.createElement("button");
      doc.id = "exportDocV13";
      doc.type = "button";
      doc.className = "ghost export-doc-v13";
      doc.textContent = "DOC";
      doc.title = "Descargar para Word";
      doc.addEventListener("click", downloadDoc);
      pdf.after(doc);
    }
  }

  function syncRoute() {
    setTimeout(loadPresentation, 180);
  }

  function init() {
    installCreateFieldControls();
    installWorkspaceFieldControls();
    installDesignLink();
    installExports();
    watchPreview();
    $("#createForm")?.addEventListener("submit", createTaskV13, true);
    window.addEventListener("hashchange", syncRoute);
    const badge = $("#accessBadge");
    if (badge) new MutationObserver(() => { syncWorkspaceFieldUI(); if (projectId()) loadPresentation(); }).observe(badge, { childList:true, subtree:true });
    syncRoute();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
  else init();
})();
