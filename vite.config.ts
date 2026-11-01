/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Where the dev server forwards /api. In docker compose this is http://backend:8000.
const apiTarget = process.env.VITE_API_PROXY ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    // Tenants are subdomains: cactus.localhost:5173 is the cactus tenant.
    allowedHosts: [".localhost"],
    proxy: {
      // changeOrigin stays false: Django must see the browser's Host (cactus.localhost:5173) to pick the tenant,
      // and the refresh cookie stays first-party because the browser only ever talks to its own origin.
      "/api": { target: apiTarget, changeOrigin: false, xfwd: true },
      // Public uploads (company logos). Personal files never use /media: they go through signed /api/v1/files links.
      "/media": { target: apiTarget, changeOrigin: false },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { charts: ["recharts"] },
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
    environment: "node",
  },
});
