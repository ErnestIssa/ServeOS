import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    preserveSymlinks: true
  },
  optimizeDeps: {
    include: ["@serveos/core-loading"]
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

