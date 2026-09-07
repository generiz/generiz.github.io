(() => {
  "use strict";

  const API = "https://ucom-api.ufotech.com.py";
  const ADMIN_KEY = "ucom.admin.session.v2";
  const DESIGN_KEY = "ucom.design.selection.v1";
  const projectId = new URLSearchParams(location.search).get("project") || "";
  const $ = s => document.querySelector(s);
  let applying = false;

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

  function note(text, error = false) {
    const n = $("#saveNote");
    if (n) { n.textContent = text; n.style.color = error ? "#b42318" : ""; }
    const floating = $("#applyFloatingV13");
    if (floating) floating.textContent = error ? text : (text.includes("Aplicado") ? "Aplicado ✓" : floating.textContent);
  }

  async function applyToTask() {
    if (applying) return;
    if (!projectId) { note("Diseño guardado como predeterminado"); return; }
    const token = sessionStorage.getItem(ADMIN_KEY) || "";
    if (!token) { note("Ingresá como administrador", true); return; }
    let design;
    try { design = JSON.parse(localStorage.getItem(DESIGN_KEY) || "null"); } catch {}
    if (!design) { note("Elegí un diseño", true); return; }
    applying = true;
    const floating = $("#applyFloatingV13");
    if (floating) { floating.disabled = true; floating.textContent = "Aplicando…"; }
    try {
      const current = await xhr("GET", `/api/projects/${encodeURIComponent(projectId)}/presentation-v13`, token);
      design.members = !!current.show_members;
      await xhr("PUT", `/api/projects/${encodeURIComponent(projectId)}/presentation-v13`, token, {
        show_professor: !!current.show_professor,
        show_due: !!current.show_due,
        show_members: !!current.show_members,
        design,
      });
      note("Aplicado a la tarea ✓");
      setTimeout(() => { location.href = `../#/p/${encodeURIComponent(projectId)}`; }, 650);
    } catch (error) {
      note(error.message || "No se pudo aplicar", true);
      if (floating) { floating.disabled = false; floating.textContent = "Aplicar diseño"; }
      applying = false;
    }
  }

  function install() {
    const back = $(".back");
    if (back && projectId) back.href = `../#/p/${encodeURIComponent(projectId)}`;

    const apply = $("#applyBtn");
    apply?.addEventListener("click", () => setTimeout(applyToTask, 0));

    if (!$("#applyFloatingV13")) {
      const button = document.createElement("button");
      button.id = "applyFloatingV13";
      button.type = "button";
      button.textContent = projectId ? "Aplicar diseño" : "Guardar diseño";
      button.style.cssText = "position:fixed;right:22px;bottom:22px;z-index:50;border:0;border-radius:999px;padding:13px 20px;background:#17191c;color:#fff;font:700 14px system-ui;box-shadow:0 12px 34px rgba(0,0,0,.24);cursor:pointer";
      button.addEventListener("click", () => {
        if (apply) apply.click();
        else applyToTask();
      });
      document.body.appendChild(button);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once:true });
  else install();
})();
