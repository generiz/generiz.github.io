(() => {
  "use strict";

  const API = "https://ucom-api.ufotech.com.py";
  const GOOGLE_KEY = "ucom.google.session.v11";
  const PENDING_KEY = "ucom.pending.class.v20";
  const $ = (s, root = document) => root.querySelector(s);

  let joining = false;
  let lastAttempt = "";
  let timer = 0;

  function classProjectId() {
    const match = location.hash.match(/^#\/class\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function rememberPendingFromRoute() {
    const id = classProjectId();
    if (id) localStorage.setItem(PENDING_KEY, id);
    return id;
  }

  function targetProjectId() {
    return rememberPendingFromRoute() || localStorage.getItem(PENDING_KEY) || "";
  }

  function googleToken() {
    return localStorage.getItem(GOOGLE_KEY) || "";
  }

  function attemptKey(projectId, token) {
    return `${projectId}:${token.slice(0, 18)}`;
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
        try { data = req.responseText ? JSON.parse(req.responseText) : {}; } catch {}
        if (req.status >= 200 && req.status < 300) resolve(data);
        else reject(Object.assign(new Error(data.error || `HTTP ${req.status || 0}`), { status:req.status, data }));
      };
      req.onerror = () => reject(new Error("No se pudo conectar con el servidor"));
      req.send(body === undefined ? null : JSON.stringify(body));
    });
  }

  function showState(message, error = false) {
    const card = $("#classJoinDialog .class-join-card-v11");
    if (card) {
      let box = $("#classJoinStateV17", card);
      if (!box) {
        box = document.createElement("div");
        box.id = "classJoinStateV17";
        box.className = "class-join-state-v17";
        const googleArea = $("#classGoogleAreaV11", card);
        (googleArea || card).after(box);
      }
      box.textContent = message;
      box.classList.toggle("error", error);
    }

    const toast = $("#toast");
    if (!card && toast) {
      toast.textContent = message;
      toast.className = `toast show${error ? " error" : ""}`;
      setTimeout(() => {
        if (toast.textContent === message) toast.className = "toast";
      }, 4200);
    }
  }

  async function joinIfReady(force = false) {
    const projectId = targetProjectId();
    const token = googleToken();
    if (!projectId || !token || joining) return;

    const key = attemptKey(projectId, token);
    if (!force && lastAttempt === key) return;
    lastAttempt = key;
    joining = true;
    showState("Ingresando a la tarea…", false);

    try {
      const data = await xhr("POST", `/api/projects/${encodeURIComponent(projectId)}/google-join-session-v11`, token, {});
      if (!data?.project?.id && !data?.ok) throw new Error("No se pudo asociar tu cuenta a la tarea");

      localStorage.removeItem(PENDING_KEY);
      sessionStorage.setItem(`ucom.participant.${projectId}`, token);
      $("#classJoinDialog")?.close();
      $("#memberDialog")?.close();

      history.replaceState(null, "", `${location.pathname}#/p/${encodeURIComponent(projectId)}`);
      location.reload();
    } catch (error) {
      if (error.status === 401) {
        localStorage.removeItem(GOOGLE_KEY);
        lastAttempt = "";
        showState("La sesión de Google venció. Ingresá de nuevo.", true);
      } else if (error.status === 403) {
        showState(error.message || "Tu correo no está autorizado para esta tarea", true);
      } else if (error.status === 409) {
        showState(error.message || "La tarea ya alcanzó el cupo de integrantes", true);
      } else if (error.status === 404) {
        localStorage.removeItem(PENDING_KEY);
        showState("La tarea compartida ya no existe.", true);
      } else {
        showState(error.message || "No se pudo ingresar a la tarea", true);
      }
    } finally {
      joining = false;
    }
  }

  function schedule(force = false) {
    clearTimeout(timer);
    rememberPendingFromRoute();
    timer = setTimeout(() => joinIfReady(force), 120);
  }

  function init() {
    rememberPendingFromRoute();
    schedule();

    const observer = new MutationObserver(() => schedule());
    observer.observe(document.body, { childList:true, subtree:true });

    window.addEventListener("hashchange", () => {
      rememberPendingFromRoute();
      lastAttempt = "";
      schedule();
    });

    // Google can finish authentication after the class dialog has already
    // disappeared or the hash has been cleared. The pending class id survives
    // that navigation, so the membership is completed on the landing page too.
    setInterval(() => {
      if (targetProjectId() && googleToken()) joinIfReady(false);
    }, 300);

    document.addEventListener("click", event => {
      if (event.target.closest("#classJoinDialog")) rememberPendingFromRoute();
      if (!event.target.closest("#continueGoogleV11")) return;
      setTimeout(() => joinIfReady(true), 0);
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
  else init();
})();
