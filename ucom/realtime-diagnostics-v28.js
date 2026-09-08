(() => {
  "use strict";
  const API = "https://ucom-api.ufotech.com.py";
  const $ = (s, root = document) => root.querySelector(s);
  let last = "";

  async function check() {
    if (!location.hash.startsWith("#/p/")) return;
    const state = window.UCOMDirectCanvasV27?.getState?.();
    if (state?.connected) { last = "connected"; return; }
    try {
      const response = await fetch(`${API}/api/realtime-v28/status`, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      last = data?.websocket_engine === "websockets-sansio" ? "transport-ready" : "transport-unknown";
      const status = $("#canvasStatusV23");
      if (status && !state?.connected) {
        status.className = "reconnecting";
        status.innerHTML = "<i></i> Esperando WebSocket…";
        status.title = `Backend ${data.build || "V28"} · ${data.websocket_engine || "WebSocket"}`;
      }
    } catch {
      last = "backend-old";
      const status = $("#canvasStatusV23");
      if (status && !state?.connected) {
        status.className = "offline";
        status.innerHTML = "<i></i> Servidor sin realtime V28";
        status.title = "El frontend está actualizado pero el backend todavía no tomó V28.";
      }
    }
  }

  setInterval(check, 3500);
  window.addEventListener("hashchange", () => setTimeout(check, 800));
  setTimeout(check, 1800);
  window.UCOMRealtimeDiagnosticsV28 = { check, getState: () => last };
})();
