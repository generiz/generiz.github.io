(() => {
  "use strict";

  // IA retirada de UCOM Workspace. La maquetación vuelve a ser completamente manual.
  const style = document.createElement("style");
  style.textContent = `
    #aiLayoutV26,
    #designAiV29,
    #aiLocalDialogV28 {
      display: none !important;
    }
  `;
  document.head.appendChild(style);

  const removeLegacyAI = () => {
    document.querySelector("#aiLocalDialogV28")?.remove();
    document.querySelector("#aiLayoutV26")?.remove();
    document.querySelector("#designAiV29")?.remove();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", removeLegacyAI, { once: true });
  } else {
    removeLegacyAI();
  }

  const observer = new MutationObserver(removeLegacyAI);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
