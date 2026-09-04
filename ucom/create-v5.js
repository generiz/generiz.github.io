(() => {
  "use strict";

  const loader = document.createElement("script");
  loader.src = "./create-v6.js";
  document.head.appendChild(loader);

  const deleteLoader = document.createElement("script");
  deleteLoader.src = "./delete-v7.js";
  document.head.appendChild(deleteLoader);

  const $ = (s) => document.querySelector(s);

  function selectedCreateType() {
    return document.querySelector('#createForm input[name="work_type"]:checked')?.value || "group";
  }

  function syncCreateType() {
    const type = selectedCreateType();
    const hidden = $("#createWorkType");
    const max = $("#createMaxMembers");
    const wrap = $("#createCapacityWrap");
    if (hidden) { hidden.value = type; hidden.dispatchEvent(new Event("change", { bubbles: true })); }
    if (type === "individual") {
      if (max) { max.value = "1"; max.disabled = true; }
      wrap?.classList.add("hidden");
    } else {
      wrap?.classList.remove("hidden");
      if (max) { max.disabled = false; max.min = "2"; if (Number(max.value) < 2) max.value = "6"; }
    }
  }

  function syncCreateDate() {
    const due = $("#createDueDate")?.value || "";
    const date = $("#createClassDate");
    if (date) date.value = due ? due.slice(0, 10) : "";
  }

  function syncWorkspaceDate() {
    const due = $("#dueDateInput")?.value || "";
    const date = $("#classDateInput");
    const next = due ? due.slice(0, 10) : "";
    if (!date || date.value === next) return;
    date.value = next;
    date.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function syncWorkspaceType() {
    const type = $("#workTypeInput")?.value || "group";
    const wrap = $("#workspaceCapacityWrap");
    const max = $("#maxMembersInput");
    if (type === "individual") {
      wrap?.classList.add("hidden");
      if (max) max.value = "1";
    } else {
      wrap?.classList.remove("hidden");
      if (max) { max.min = "2"; if (Number(max.value) < 2) max.value = "6"; }
    }
  }

  function clearCreateError() {
    const error = $("#createError");
    if (!error) return;
    error.textContent = "";
    error.classList.add("hidden");
  }

  function mirrorToastError() {
    const toast = $("#toast");
    const dialog = $("#createDialog");
    const error = $("#createError");
    if (!toast || !dialog?.open || !error || !toast.classList.contains("error")) return;
    const text = toast.textContent.trim();
    if (!text) return;
    error.textContent = text;
    error.classList.remove("hidden");
  }

  function init() {
    document.querySelectorAll('#createForm input[name="work_type"]').forEach(radio => radio.addEventListener("change", syncCreateType));
    $("#createDueDate")?.addEventListener("input", syncCreateDate);
    $("#dueDateInput")?.addEventListener("input", syncWorkspaceDate);
    $("#workTypeInput")?.addEventListener("change", syncWorkspaceType);
    $("#createForm")?.addEventListener("submit", () => { clearCreateError(); syncCreateType(); syncCreateDate(); }, true);
    $("#createForm")?.addEventListener("reset", () => setTimeout(() => { clearCreateError(); syncCreateType(); syncCreateDate(); }, 0));
    const toast = $("#toast");
    if (toast) new MutationObserver(mirrorToastError).observe(toast, { childList: true, attributes: true, subtree: true });
    syncCreateType();
    syncCreateDate();
    syncWorkspaceType();
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
