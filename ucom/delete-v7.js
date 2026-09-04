(() => {
  "use strict";

  const API = "https://ucom-api.ufotech.com.py";
  const ADMIN_KEY = "ucom.admin.session.v2";
  const $ = (s) => document.querySelector(s);

  function toast(message, error = false) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.className = `toast show ${error ? "error" : ""}`;
    setTimeout(() => {
      if (el.textContent === message) el.className = "toast";
    }, 3500);
  }

  function enhanceProjectList() {
    const list = $("#projectList");
    if (!list) return;

    list.querySelectorAll(".recent-item").forEach(item => {
      if (item.querySelector(".project-delete")) return;
      const open = item.querySelector(".project-open[data-id]");
      if (!open) return;

      const actions = document.createElement("div");
      actions.className = "workspace-actions";
      open.replaceWith(actions);
      actions.append(open);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "danger-btn project-delete";
      del.dataset.id = open.dataset.id || "";
      del.textContent = "Eliminar";
      actions.append(del);
    });
  }

  async function deleteProject(button) {
    const id = button.dataset.id || "";
    if (!id) return;

    const item = button.closest(".recent-item");
    const title = item?.querySelector("strong")?.textContent?.trim() || "esta tarea";
    if (!confirm(`¿Eliminar \"${title}\"?`)) return;

    const token = sessionStorage.getItem(ADMIN_KEY) || "";
    if (!token) {
      toast("Sesión de administrador requerida", true);
      return;
    }

    button.disabled = true;
    try {
      const response = await fetch(`${API}/api/admin/projects/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      });
      const text = await response.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch {}
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

      item?.remove();
      toast("Tarea eliminada");
    } catch (error) {
      button.disabled = false;
      toast(error.message || "No se pudo eliminar la tarea", true);
    }
  }

  function init() {
    const list = $("#projectList");
    if (!list) return;

    new MutationObserver(enhanceProjectList).observe(list, { childList: true, subtree: true });
    enhanceProjectList();

    list.addEventListener("click", event => {
      const button = event.target.closest(".project-delete");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      deleteProject(button);
    });
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
