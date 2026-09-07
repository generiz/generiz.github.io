(() => {
  "use strict";

  const API = "https://ucom-api.ufotech.com.py";
  const GOOGLE_KEY = "ucom.google.session.v11";
  let clientId = "";
  let armed = false;
  let arming = null;
  let lastError = "";

  const classProjectId = () => {
    const match = location.hash.match(/^#\/class\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : "";
  };

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
        else reject(Object.assign(new Error(data.error || `HTTP ${req.status || 0}`), { status: req.status, data }));
      };
      req.onerror = () => reject(new Error("No se pudo conectar con el servidor"));
      req.send(body === undefined ? null : JSON.stringify(body));
    });
  }

  function showError(message) {
    const text = String(message || "No se pudo ingresar con Google");
    if (text === lastError) return;
    lastError = text;
    const dialog = document.querySelector("#classJoinDialog .class-join-card-v11");
    if (dialog) {
      let box = dialog.querySelector(".google-login-error-v16");
      if (!box) {
        box = document.createElement("div");
        box.className = "google-login-error-v16";
        box.style.cssText = "margin:10px 0;padding:10px 12px;border-radius:10px;background:rgba(220,38,38,.12);color:#fecaca;font:600 12px/1.4 system-ui";
        const googleArea = dialog.querySelector("#classGoogleAreaV11");
        (googleArea || dialog).after(box);
      }
      box.textContent = text;
    }
    const toast = document.querySelector("#toast");
    if (toast) {
      toast.textContent = text;
      toast.className = "toast show error";
    }
  }

  function clearError() {
    lastError = "";
    document.querySelector(".google-login-error-v16")?.remove();
  }

  async function handleCredential(response) {
    const credential = response?.credential || "";
    if (!credential) return;
    clearError();

    // The shared-task route is the source of truth. Do not infer the target
    // from pointer/focus events inside Google's iframe.
    const projectId = classProjectId();
    try {
      if (projectId) {
        const data = await xhr(
          "POST",
          `/api/projects/${encodeURIComponent(projectId)}/google-login-v11`,
          "",
          { credential },
        );
        if (!data.token) throw new Error("Google ingresó, pero no se creó la sesión de la tarea");

        localStorage.setItem(GOOGLE_KEY, data.token);
        sessionStorage.setItem(`ucom.participant.${projectId}`, data.token);
        document.querySelector("#classJoinDialog")?.close();
        document.querySelector("#memberDialog")?.close();

        // Reload on the project route so every workspace module starts with
        // the already-confirmed project membership and the correct identity.
        history.replaceState(null, "", `${location.pathname}#/p/${encodeURIComponent(projectId)}`);
        location.reload();
        return;
      }

      const data = await xhr("POST", "/api/auth/google/session-v11", "", { credential });
      if (!data.token) throw new Error("No se creó la sesión de Google");
      localStorage.setItem(GOOGLE_KEY, data.token);
      location.reload();
    } catch (error) {
      showError(error.message || "No se pudo ingresar con Google");
    }
  }

  function loadGoogleScript() {
    if (window.google?.accounts?.id) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existing) {
        const poll = setInterval(() => {
          if (window.google?.accounts?.id) {
            clearInterval(poll);
            resolve();
          }
        }, 50);
        setTimeout(() => {
          clearInterval(poll);
          if (window.google?.accounts?.id) resolve();
          else reject(new Error("No se pudo cargar Google"));
        }, 8000);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("No se pudo cargar Google"));
      document.head.appendChild(script);
    });
  }

  async function armGoogleCallback() {
    if (arming) return arming;
    arming = (async () => {
      try {
        if (!clientId) {
          const config = await xhr("GET", "/api/auth/google/config-v11");
          clientId = config.client_id || "";
        }
        if (!clientId) return;
        await loadGoogleScript();
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        armed = true;
      } catch (error) {
        if (classProjectId()) showError(error.message || "Google no disponible");
      } finally {
        arming = null;
      }
    })();
    return arming;
  }

  function rearmSoon() {
    // google-access-v11 renders buttons dynamically and initializes GSI first.
    // Re-arm immediately afterwards so the last callback always uses the route.
    setTimeout(() => { armGoogleCallback(); }, 0);
    setTimeout(() => { armGoogleCallback(); }, 250);
  }

  function init() {
    armGoogleCallback();
    const observer = new MutationObserver(mutations => {
      if (!mutations.some(m => [...m.addedNodes].some(node => node.nodeType === 1 && (
        node.matches?.("iframe, #classJoinDialog, .google-button-v11") ||
        node.querySelector?.("iframe, #classJoinDialog, .google-button-v11")
      )))) return;
      rearmSoon();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("hashchange", () => {
      clearError();
      rearmSoon();
    });

    // A final delayed arm avoids a race with the legacy V11 initializer on load.
    setTimeout(() => armGoogleCallback(), 900);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
