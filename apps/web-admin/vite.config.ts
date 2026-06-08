import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const coreSharedSrc = path.resolve(appDir, "../../core/shared/src");

export default defineConfig({
  plugins: [react()],
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@serveos/core-shared/signup-wizard": path.join(coreSharedSrc, "signupWizard.ts"),
      "@serveos/core-shared/currency": path.join(coreSharedSrc, "currency.ts")
    }
  },
  optimizeDeps: {
    exclude: [
      "@serveos/core-shared",
      "@serveos/core-shared/signup-wizard",
      "@serveos/core-shared/currency",
      "@serveos/core-ambient",
      "@serveos/core-loading",
      "@serveos/core-theme"
    ]
  },
  server: {
    port: 5173,
    proxy: {
      "/auth": { target: "http://127.0.0.1:3000", changeOrigin: true },
      "/restaurants": { target: "http://127.0.0.1:3000", changeOrigin: true },
      "/orders": { target: "http://127.0.0.1:3000", changeOrigin: true, ws: true },
      "/health": { target: "http://127.0.0.1:3000", changeOrigin: true }
    }
  }
});

