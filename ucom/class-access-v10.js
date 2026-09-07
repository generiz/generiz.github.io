(() => {
  "use strict";

  const API = "https://ucom-api.ufotech.com.py";
  const ADMIN_KEY = "ucom.admin.session.v2";
  const $ = (s) => document.querySelector(s);

  function ensureStyle() {
    if (document.getElementById("classAccessV10Style")) return;
    const link = document.createElement("link");
    link.id = "classAccessV10Style";
    link.rel = "stylesheet";
    link.href = "./class-access-v10.css?v=10";
    document.head.appendChild(link);
  }

  function adminToken() {
    return sessionStorage.getItem(ADMIN_KEY) || "";
  }

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
        try { data = req.responseText ? JSON.parse(req.responseText) : {}; } catch { data = { raw: req.responseText || "" }; }
        if (req.status >= 200 && req.status < 300) resolve(data);
        else reject(new Error(data.error || `HTTP ${req.status || 0}`));
      };
      req.onerror = () => reject(new Error("No se pudo conectar con el servidor"));
      req.send(body === undefined ? null : JSON.stringify(body));
    });
  }

  function xhrText(method, path, token = "") {
    return new Promise((resolve, reject) => {
      const req = new XMLHttpRequest();
      req.open(method, `${API}${path}`, true);
      req.setRequestHeader("Accept", "image/svg+xml, text/plain, */*");
      if (token) req.setRequestHeader("Authorization", `Bearer ${token}`);
      req.onreadystatechange = () => {
        if (req.readyState !== 4) return;
        if (req.status >= 200 && req.status < 300) resolve(req.responseText || "");
        else {
          let message = `HTTP ${req.status || 0}`;
          try { message = JSON.parse(req.responseText || "{}").error || message; } catch {}
          reject(new Error(message));
        }
      };
      req.onerror = () => reject(new Error("No se pudo conectar con el servidor"));
      req.send();
    });
  }

  function toast(message, error = false) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.className = `toast show ${error ? "error" : ""}`;
    setTimeout(() => {
      if (el.textContent === message) el.className = "toast";
    }, 3200);
  }

  function selectedType() {
    return $("#createForm input[name='work_type']:checked")?.value || "group";
  }

  function createCount() {
    return selectedType() === "individual" ? 1 : Math.max(2, Math.min(30, Number($("#createMaxMembers")?.value) || 2));
  }

  function installNameSlots() {
    const capacity = $("#createCapacityWrap");
    const bottom = $("#createDialog .create-bottom-grid");
    if (!capacity || !bottom) return;

    const input = $("#createMaxMembers");
    if (input) {
      input.min = "2";
      input.max = "30";
      if (!Number(input.value) || Number(input.value) < 2) input.value = "4";
      capacity.replaceChildren(document.createTextNode("Cantidad de integrantes"), input);
    }

    if (!$("#createNamesSection")) {
      const section = document.createElement("div");
      section.id = "createNamesSection";
      section.className = "create-names-section";
      section.innerHTML = '<div class="create-names-head"><span>Integrantes</span><span>Opcional</span></div><div id="createNamesList" class="create-names-list"></div>';
      bottom.after(section);
    }

    const sync = () => renderNameSlots(createCount());
    input?.addEventListener("input", sync);
    document.querySelectorAll('#createForm input[name="work_type"]').forEach(radio => radio.addEventListener("change", () => setTimeout(sync, 0)));
    $("#createForm")?.addEventListener("reset", () => setTimeout(sync, 0));
    sync();
  }

  function renderNameSlots(count) {
    const list = $("#createNamesList");
    if (!list) return;
    const existing = [...list.querySelectorAll("input")].map(input => input.value);
    list.replaceChildren();
    for (let i = 0; i < count; i += 1) {
      const row = document.createElement("label");
      row.className = "create-name-row";
      const n = document.createElement("span");
      n.textContent = String(i + 1).padStart(2, "0");
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 120;
      input.placeholder = "Nombre y apellido";
      input.value = existing[i] || "";
      row.append(n, input);
      list.appendChild(row);
    }
  }

  function namesFromCreate() {
    return [...document.querySelectorAll("#createNamesList input")].map(input => input.value.trim());
  }

  function showCreateError(message) {
    const box = $("#createError");
    if (!box) return;
    box.textContent = message;
    box.classList.remove("hidden");
  }

  async function createTask(event) {
    const form = $("#createForm");
    if (!form || event.target !== form) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const token = adminToken();
    if (!token) {
      showCreateError("Sesión de administrador requerida");
      return;
    }
    if (!form.reportValidity()) return;

    const fd = new FormData(form);
    const due = String(fd.get("due_date") || "").trim();
    const type = selectedType();
    const count = createCount();
    const names = namesFromCreate().slice(0, count);
    if (!due || Number.isNaN(new Date(due).getTime()) || new Date(due).getTime() <= Date.now()) {
      showCreateError("La entrega debe ser futura");
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = "Creando…"; }
    let projectId = "";

    try {
      const created = await xhr("POST", "/api/projects", token, {
        subject: String(fd.get("subject") || ""),
        title: String(fd.get("title") || ""),
        professor: String(fd.get("professor") || ""),
        class_date: due.slice(0, 10),
        due_date: due,
        work_type: type,
        members: [],
        directives: "",
        content: "",
        template: "ucom",
        access_mode: "24h",
      });
      projectId = created.project?.id || "";
      if (!projectId) throw new Error("No se generó la tarea");

      await xhr("PUT", `/api/projects/${encodeURIComponent(projectId)}/settings`, token, {
        project_end_at: due,
        max_members: count,
      });
      await xhr("POST", `/api/projects/${encodeURIComponent(projectId)}/codes-v10/generate`, token, { count, names });

      $("#createDialog")?.close();
      form.reset();
      location.hash = `#/p/${encodeURIComponent(projectId)}`;
      setTimeout(() => showCodes(projectId), 450);
      toast("Tarea creada");
    } catch (error) {
      if (projectId) {
        try { await xhr("DELETE", `/api/admin/projects/${encodeURIComponent(projectId)}`, token); } catch {}
      }
      showCreateError(error.message || "No se pudo crear la tarea");
    } finally {
      if (button) { button.disabled = false; button.textContent = "Crear tarea"; }
    }
  }

  function enhanceMemberDialog() {
    const form = $("#memberForm");
    if (!form) return;
    const project = form.elements.project_id;
    const name = form.elements.name;
    const code = form.elements.password;
    if (!project || !name || !code) return;

    const projectLabel = project.closest("label");
    const nameLabel = name.closest("label");
    const codeLabel = code.closest("label");
    if (projectLabel) { projectLabel.id = "memberProjectLabel"; projectLabel.childNodes[0].nodeValue = "Tarea"; }
    if (codeLabel) codeLabel.childNodes[0].nodeValue = "Código de acceso";
    if (nameLabel) nameLabel.childNodes[0].nodeValue = "Nombre y apellido";
    name.required = false;
    name.placeholder = "Si el acceso no tiene nombre";
    code.placeholder = "0000";
    code.inputMode = "numeric";
    code.autocomplete = "one-time-code";
    if (codeLabel && nameLabel && codeLabel.nextElementSibling !== nameLabel) nameLabel.before(codeLabel);
    const title = form.querySelector("h2");
    if (title) title.textContent = "Entrar a la tarea";
  }

  async function joinWithCode(event) {
    const form = $("#memberForm");
    if (!form || event.target !== form) return;
    const fd = new FormData(form);
    const code = String(fd.get("password") || "").trim();

    // Old tasks can still use their previous password flow.
    if (!/^\d{4}$/.test(code)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    const id = String(fd.get("project_id") || "").trim();
    const name = String(fd.get("name") || "").trim();
    if (!id) { toast("Falta la tarea", true); return; }

    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      const data = await xhr("POST", `/api/projects/${encodeURIComponent(id)}/join-code-v10`, "", { code, name });
      sessionStorage.setItem(`ucom.participant.${id}`, data.token);
      form.reset();
      $("#memberDialog")?.close();
      location.hash = `#/p/${encodeURIComponent(id)}`;
    } catch (error) {
      toast(error.message || "No se pudo ingresar", true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  function classRoute() {
    const match = location.hash.match(/^#\/class\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function syncClassRoute() {
    const id = classRoute();
    const form = $("#memberForm");
    const dialog = $("#memberDialog");
    const projectLabel = $("#memberProjectLabel");
    if (!form || !dialog) return;
    if (!id) {
      projectLabel?.classList.remove("hidden");
      return;
    }
    form.elements.project_id.value = id;
    projectLabel?.classList.add("hidden");
    if (!dialog.open) dialog.showModal();
    setTimeout(() => form.elements.password?.focus(), 0);
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  }

  async function copyText(value) {
    try { await navigator.clipboard.writeText(value); toast("Copiado"); }
    catch { toast("No se pudo copiar", true); }
  }

  async function showCodes(projectId) {
    const token = adminToken();
    if (!token || !projectId) return;
    try {
      let data = await xhr("GET", `/api/projects/${encodeURIComponent(projectId)}/codes-v10`, token);
      if (!data.codes?.length) {
        const members = String($("#membersInput")?.value || "").split(/\r?\n/).map(v => v.trim()).filter(Boolean);
        const count = $("#workTypeInput")?.value === "individual" ? 1 : Math.max(2, Math.min(30, Number($("#maxMembersInput")?.value) || members.length || 2));
        data = await xhr("POST", `/api/projects/${encodeURIComponent(projectId)}/codes-v10/generate`, token, { count, names: members });
      }
      await renderCodesDialog(projectId, data);
    } catch (error) {
      toast(error.message || "No se pudieron cargar los accesos", true);
    }
  }

  async function renderCodesDialog(projectId, data) {
    const dialog = $("#accessDialog");
    const card = dialog?.querySelector(".share-dialog");
    if (!dialog || !card) return;
    const codes = data.codes || [];
    const classLink = data.class_url || `${location.origin}${location.pathname}#/class/${encodeURIComponent(projectId)}`;

    card.innerHTML = `
      <div class="dialog-head"><div><h2>Compartir tarea</h2></div><button type="button" class="icon-btn code-share-close">×</button></div>
      <div class="class-share-v10">
        <div class="class-qr-v10"><div id="classQrImage" class="class-qr-image"></div></div>
        <div class="class-link-v10"><code>${escapeHtml(classLink)}</code><button type="button" class="ghost copy-class-link">Copiar enlace</button></div>
      </div>
      <div class="codes-head-v10"><strong>Accesos</strong><span>${codes.length}</span></div>
      <div class="codes-list-v10">
        ${codes.map(item => `
          <div class="code-row-v10">
            <span class="code-slot-v10">${String(item.slot_number).padStart(2, "0")}</span>
            <div class="code-person-v10"><strong>${escapeHtml(item.assigned_name || "Sin nombre")}</strong><span>${item.claimed_at ? "Ingresó" : "Disponible"}</span></div>
            <button type="button" class="code-value-v10" data-code="${escapeHtml(item.code)}">${escapeHtml(item.code)}</button>
          </div>`).join("")}
      </div>
      <div class="code-actions-v10"><button type="button" class="ghost regenerate-codes-v10">Regenerar códigos</button></div>`;

    card.querySelector(".code-share-close")?.addEventListener("click", () => dialog.close());
    card.querySelector(".copy-class-link")?.addEventListener("click", () => copyText(classLink));
    card.querySelectorAll(".code-value-v10").forEach(button => button.addEventListener("click", () => copyText(button.dataset.code || "")));
    card.querySelector(".regenerate-codes-v10")?.addEventListener("click", async () => {
      if (!confirm("¿Generar códigos nuevos? Los anteriores dejarán de funcionar.")) return;
      try {
        const names = codes.map(item => item.assigned_name || "");
        const fresh = await xhr("POST", `/api/projects/${encodeURIComponent(projectId)}/codes-v10/generate`, adminToken(), { count: Math.max(1, codes.length), names });
        await renderCodesDialog(projectId, fresh);
        toast("Códigos regenerados");
      } catch (error) { toast(error.message || "No se pudieron regenerar", true); }
    });

    try {
      const svg = await xhrText("GET", `/api/projects/${encodeURIComponent(projectId)}/class-qr-v10`, adminToken());
      const target = card.querySelector("#classQrImage");
      if (target) target.innerHTML = svg;
    } catch {}

    if (!dialog.open) dialog.showModal();
  }

  function interceptShare(event) {
    const button = event.target.closest("#accessBtn");
    if (!button) return;
    const match = location.hash.match(/^#\/p\/([^/]+)\/?$/);
    if (!match) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showCodes(decodeURIComponent(match[1]));
  }

  function init() {
    ensureStyle();
    installNameSlots();
    enhanceMemberDialog();
    document.addEventListener("submit", createTask, true);
    document.addEventListener("submit", joinWithCode, true);
    document.addEventListener("click", interceptShare, true);
    window.addEventListener("hashchange", syncClassRoute);
    syncClassRoute();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
