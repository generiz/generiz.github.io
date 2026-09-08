(() => {
  "use strict";
  const buttonId = "composerLaunchV31";
  const projectId = () => {
    const match = location.hash.match(/^#\/p\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : "";
  };
  function sync() {
    const actions = document.querySelector(".workspace-actions");
    if (!actions) return;
    let link = document.getElementById(buttonId);
    if (!link) {
      link = document.createElement("a");
      link.id = buttonId;
      link.className = "ghost";
      link.textContent = "Composer";
      link.title = "Abrir editor multipágina";
      const design = actions.querySelector(".design-link");
      if (design) actions.insertBefore(link, design);
      else actions.appendChild(link);
    }
    const id = projectId();
    link.classList.toggle("hidden", !id);
    link.href = id ? `./composer/#/p/${encodeURIComponent(id)}` : "./composer/";
  }
  window.addEventListener("hashchange", sync);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, { once: true });
  else sync();
  setInterval(sync, 1200);
})();
