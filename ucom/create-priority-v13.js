(() => {
  "use strict";

  const API = "https://ucom-api.ufotech.com.py";
  const ADMIN_KEY = "ucom.admin.session.v2";
  const DESIGN_KEY = "ucom.design.selection.v1";
  const DEFAULT_DESIGN = { template:"institutional", identity:"ucom", p:"#43358b", s:"#5bc5f2", logo:true, stripe:true, members:true, footer:true };
  const $ = s => document.querySelector(s);

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
        try { data = req.responseText ? JSON.parse(req.responseText) : {}; } catch {}
        if (req.status >= 200 && req.status < 300) resolve(data);
        else reject(new Error(data.error || `HTTP ${req.status || 0}`));
      };
      req.onerror = () => reject(new Error("No se pudo conectar con el servidor"));
      req.send(body === undefined ? null : JSON.stringify(body));
    });
  }

  function designSelection() {
    try {
      const saved = JSON.parse(localStorage.getItem(DESIGN_KEY) || "null");
      if (saved && typeof saved === "object") return { ...DEFAULT_DESIGN, ...saved };
    } catch {}
    return { ...DEFAULT_DESIGN };
  }

  function selectedType() {
    return $('#createForm input[name="work_type"]:checked')?.value || "group";
  }

  function capacity() {
    return selectedType() === "individual" ? 1 : Math.max(2, Math.min(30, Number($("#createMaxMembers")?.value) || 4));
  }

  function showError(message) {
    const box = $("#createError");
    if (!box) return;
    box.textContent = message;
    box.classList.remove("hidden");
  }

  function toast(message, error = false) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.className = `toast show ${error ? "error" : ""}`;
    setTimeout(() => { if (el.textContent === message) el.className = "toast"; }, 3000);
  }

  async function submit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== "createForm") return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const token = sessionStorage.getItem(ADMIN_KEY) || "";
    if (!token) { showError("Sesión de administrador requerida"); return; }

    const showProfessor = $("#createShowProfessorV13")?.checked !== false;
    const showDue = $("#createShowDueV13")?.checked !== false;
    const showMembers = $("#createShowMembersV13")?.checked !== false;
    const dueInput = $("#createDueDate");
    if (dueInput) dueInput.required = showDue;
    if (!form.reportValidity()) return;

    const fd = new FormData(form);
    const due = showDue ? String(dueInput?.value || "").trim() : "";
    if (showDue && (!due || Number.isNaN(new Date(due).getTime()) || new Date(due).getTime() <= Date.now())) {
      showError("La entrega debe ser futura");
      return;
    }
    const googleMode = $("#createGoogleMode")?.value || "all";
    const domains = $("#createAllowedDomains")?.value || "";
    const codeEnabled = $("#createCodeEnabled") ? !!$("#createCodeEnabled").checked : true;
    if (googleMode === "domains" && !domains.trim()) { showError("Indicá el dominio permitido"); return; }

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
        work_type: selectedType(),
        members: [], directives:"", content:"", template:"ucom", access_mode:"24h",
      });
      id = created.project?.id || "";
      if (!id) throw new Error("No se generó la tarea");
      await xhr("PUT", `/api/projects/${encodeURIComponent(id)}/settings`, token, { project_end_at:due, max_members:capacity() });
      await xhr("PUT", `/api/projects/${encodeURIComponent(id)}/auth-policy-v11`, token, { google_mode:googleMode, allowed_domains:domains, code_enabled:codeEnabled });
      const design = designSelection();
      design.members = showMembers;
      await xhr("PUT", `/api/projects/${encodeURIComponent(id)}/presentation-v13`, token, {
        show_professor:showProfessor, show_due:showDue, show_members:showMembers, design,
      });
      form.closest("dialog")?.close();
      form.reset();
      location.hash = `#/p/${encodeURIComponent(id)}`;
      toast("Tarea creada");
    } catch (error) {
      if (id) xhr("DELETE", `/api/admin/projects/${encodeURIComponent(id)}`, token).catch(() => {});
      showError(error.message || "No se pudo crear la tarea");
    } finally {
      if (button) { button.disabled = false; button.textContent = "Crear tarea"; }
    }
  }

  document.addEventListener("submit", submit, true);
})();
