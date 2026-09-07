(() => {
  "use strict";

  const API = "https://ucom-api.ufotech.com.py";
  const ADMIN_KEY = "ucom.admin.session.v2";

  const $ = (selector) => document.querySelector(selector);

  function setMessage(message = "", state = "") {
    const hint = $("#adminHint");
    if (!hint) return;
    hint.textContent = message;
    hint.dataset.state = state;
  }

  function requestLogin(password) {
    return new Promise((resolve, reject) => {
      const req = new XMLHttpRequest();
      req.open("POST", `${API}/api/admin/login`, true);
      req.setRequestHeader("Accept", "application/json");
      req.setRequestHeader("Content-Type", "application/json");
      req.onreadystatechange = () => {
        if (req.readyState !== 4) return;
        let data = {};
        try {
          data = req.responseText ? JSON.parse(req.responseText) : {};
        } catch {
          data = {};
        }
        if (req.status >= 200 && req.status < 300) {
          resolve(data);
          return;
        }
        const error = new Error(data.error || (req.status ? `Error ${req.status}` : "No se pudo conectar con el servidor"));
        error.status = req.status;
        reject(error);
      };
      req.onerror = () => reject(new Error("No se pudo conectar con el servidor"));
      req.ontimeout = () => reject(new Error("El servidor tardó demasiado en responder"));
      req.timeout = 12000;
      req.send(JSON.stringify({ password }));
    });
  }

  async function login(event) {
    const form = $("#adminForm");
    if (!form || event.target !== form) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const password = new FormData(form).get("password")?.toString() || "";
    const submit = form.querySelector('button[type="submit"]');

    if (!password) {
      setMessage("Escribí la contraseña.", "error");
      form.elements.password?.focus();
      return;
    }

    if (submit) {
      submit.disabled = true;
      submit.dataset.originalText ||= submit.textContent || "Entrar";
      submit.textContent = "Ingresando…";
    }
    setMessage("Comprobando…", "loading");

    try {
      const data = await requestLogin(password);
      if (!data?.token) throw new Error("El servidor no devolvió una sesión de administrador");

      sessionStorage.setItem(ADMIN_KEY, data.token);
      setMessage("Acceso correcto.", "success");

      const state = $("#adminState");
      if (state) state.textContent = "Admin conectado";
      $("#adminLogoutBtn")?.classList.remove("hidden");
      $("#newProjectBtn")?.classList.remove("hidden");

      setTimeout(() => {
        $("#adminDialog")?.close();
        window.location.reload();
      }, 180);
    } catch (error) {
      sessionStorage.removeItem(ADMIN_KEY);
      setMessage(error.message || "No se pudo iniciar sesión.", "error");
      form.elements.password?.select();
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = submit.dataset.originalText || "Entrar";
      }
    }
  }

  function openDialog(event) {
    const button = event.target.closest("#adminLoginBtn");
    if (!button) return;
    const dialog = $("#adminDialog");
    if (!dialog) return;
    setMessage("", "");
    if (!dialog.open) dialog.showModal();
    setTimeout(() => $("#adminForm [name='password']")?.focus(), 0);
  }

  function clearOnInput(event) {
    if (!event.target.matches("#adminForm [name='password']")) return;
    const hint = $("#adminHint");
    if (hint?.dataset.state === "error") setMessage("", "");
  }

  function init() {
    document.addEventListener("submit", login, true);
    document.addEventListener("click", openDialog, true);
    document.addEventListener("input", clearOnInput, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();

(() => {
  if (document.querySelector('script[data-google-login-fix-v16]')) return;
  const script = document.createElement("script");
  script.src = "./google-login-fix-v16.js?v=16";
  script.defer = true;
  script.dataset.googleLoginFixV16 = "1";
  document.head.appendChild(script);
})();
