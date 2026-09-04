(() => {
  "use strict";

  const API = "https://ucom-api.ufotech.com.py";
  const ADMIN_KEY = "ucom.admin.session.v2";
  const form = document.getElementById("createForm");
  if (!form) return;

  function showError(message) {
    const box = document.getElementById("createError");
    if (!box) return;
    box.textContent = message || "No se pudo crear la tarea";
    box.classList.remove("hidden");
  }

  function clearError() {
    const box = document.getElementById("createError");
    if (!box) return;
    box.textContent = "";
    box.classList.add("hidden");
  }

  function request(method, path, token, body) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, `${API}${path}`, true);
      xhr.setRequestHeader("Accept", "application/json");
      if (body !== undefined) xhr.setRequestHeader("Content-Type", "application/json");
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.onreadystatechange = () => {
        if (xhr.readyState !== 4) return;
        let data = {};
        try { data = xhr.responseText ? JSON.parse(xhr.responseText) : {}; } catch {}
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || `HTTP ${xhr.status || 0}`));
      };
      xhr.onerror = () => reject(new Error("No se pudo conectar con el servidor"));
      xhr.send(body === undefined ? null : JSON.stringify(body));
    });
  }

  async function onSubmit(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    clearError();

    if (!form.reportValidity()) return;

    const token = sessionStorage.getItem(ADMIN_KEY) || "";
    if (!token) {
      showError("Sesión de administrador requerida");
      return;
    }

    const fd = new FormData(form);
    const due = String(fd.get("due_date") || "").trim();
    const type = form.querySelector('input[name="work_type"]:checked')?.value || "group";
    const maximum = type === "individual" ? 1 : Math.max(2, Math.min(30, Number(fd.get("max_members")) || 6));
    const mode = String(fd.get("access_mode") || "project_end");
    const custom = String(fd.get("access_expires_at") || "").trim();

    if (!due || Number.isNaN(new Date(due).getTime()) || new Date(due).getTime() <= Date.now()) {
      showError("La entrega debe ser una fecha y hora futura");
      return;
    }
    if (mode === "custom" && (!custom || Number.isNaN(new Date(custom).getTime()) || new Date(custom).getTime() <= Date.now())) {
      showError("El vencimiento del acceso debe ser futuro");
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = "Creando…"; }

    let projectId = "";
    try {
      const coreMode = mode === "project_end" || mode === "custom" ? "deadline" : mode;
      const created = await request("POST", "/api/projects", token, {
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
        access_mode: coreMode,
      });

      projectId = created.project?.id || "";
      if (!projectId) throw new Error("El servidor no devolvió el código de la tarea");

      await request("PUT", `/api/projects/${encodeURIComponent(projectId)}/settings`, token, {
        project_end_at: due,
        max_members: maximum,
      });

      await request("POST", `/api/projects/${encodeURIComponent(projectId)}/access-v3/rotate`, token, {
        access_mode: mode,
        access_expires_at: custom,
      });

      document.getElementById("createDialog")?.close();
      form.reset();
      location.hash = `#/p/${encodeURIComponent(projectId)}`;
    } catch (error) {
      if (projectId) {
        try { await request("DELETE", `/api/projects/${encodeURIComponent(projectId)}`, token); } catch {}
      }
      showError(error.message || "No se pudo crear la tarea");
    } finally {
      if (button) { button.disabled = false; button.textContent = "Crear tarea"; }
    }
  }

  form.addEventListener("submit", onSubmit, true);
})();
