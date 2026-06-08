import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, "../..");
const coreSharedSrc = path.join(repoRoot, "core/shared/src");
const coreAmbientSrc = path.join(repoRoot, "core/ambient/src");
const coreLoadingSrc = path.join(repoRoot, "core/loading/src");
const coreThemeSrc = path.join(repoRoot, "core/theme/src");

const workspacePackages = [
  "@serveos/core-shared",
  "@serveos/core-shared/signup-wizard",
  "@serveos/core-shared/currency",
  "@serveos/core-ambient",
  "@serveos/core-loading",
  "@serveos/core-theme"
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    preserveSymlinks: false,
    dedupe: ["react", "react-dom"],
    alias: {
      "@serveos/core-shared/signup-wizard": path.join(coreSharedSrc, "signupWizard.ts"),
      "@serveos/core-shared/currency": path.join(coreSharedSrc, "currency.ts"),
      "@serveos/core-shared": path.join(coreSharedSrc, "index.ts"),
      "@serveos/core-ambient": path.join(coreAmbientSrc, "index.ts"),
      "@serveos/core-loading": path.join(coreLoadingSrc, "index.ts"),
      "@serveos/core-theme": path.join(coreThemeSrc, "index.ts")
    }
  },
  optimizeDeps: {
    entries: ["src/main.tsx"],
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "framer-motion"
    ],
    exclude: workspacePackages
  },
  server: {
    port: 5173,
    fs: {
      allow: [appDir, repoRoot]
    },
    proxy: {
      "/auth": { target: "http://127.0.0.1:3000", changeOrigin: true },
      "/restaurants": { target: "http://127.0.0.1:3000", changeOrigin: true },
      "/orders": { target: "http://127.0.0.1:3000", changeOrigin: true, ws: true },
      "/health": { target: "http://127.0.0.1:3000", changeOrigin: true }
    }
  }
});
