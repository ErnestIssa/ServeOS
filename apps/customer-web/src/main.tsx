import { loadClientConfig } from "./bootstrap/clientConfig";
import { captureClientException, initSentryFromConfig } from "./sentry";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { AppErrorBoundary } from "./AppErrorBoundary";
import "./index.css";

const rootEl = document.getElementById("root");

function renderFatal(message: string) {
  if (!rootEl) return;
  rootEl.innerHTML = `<div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif;background:#020617;color:#e2e8f0;text-align:center"><div style="max-width:28rem"><p style="font-size:1.25rem;font-weight:800;margin:0 0 12px">ServeOS could not start</p><p style="margin:0 0 16px;font-size:0.9rem;line-height:1.5;color:#94a3b8">${message}</p><button type="button" onclick="location.reload()" style="border:0;border-radius:9999px;padding:10px 18px;font-weight:700;background:#7c3aed;color:white;cursor:pointer">Reload page</button></div></div>`;
}

async function bootstrap() {
  if (!rootEl) throw new Error("Missing #root element");

  const config = await loadClientConfig();
  initSentryFromConfig(config);

  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>
  );
  sessionStorage.removeItem("serveos.vite.preloadReload");
}

void bootstrap().catch((error) => {
  console.error("ServeOS customer-web bootstrap failed", error);
  captureClientException(error, { area: "bootstrap" });
  renderFatal("The app failed to load. Reload to try again. Your signup progress is saved in this browser session.");
});
