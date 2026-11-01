import { defineConfig } from "@playwright/test";

/** End-to-end tests against the real backend.
 * Needs the backend on :8000 with `seed_demo` data (docker compose up, or runserver). The frontend dev server is
 * started here if it isn't running. Uses the installed Google Chrome, so no browser download is needed. */
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // every spec uses the same seed_demo tenant (delegations, approvals): files must not overlap
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://cactus.localhost:5173",
    channel: "chrome",
    locale: "ar-SA",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run dev -- --strictPort",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      // the mock BioTime server the cloud connector reads (tools/mock_biotime.py, Phase 3 task 9)
      command: "python3 ../backend/tools/mock_biotime.py --port 8091",
      url: "http://127.0.0.1:8091/",
      reuseExistingServer: true,
      timeout: 15_000,
    },
    {
      // the mock BioStar 2 server (tools/mock_biostar.py, Phase 3 task 10)
      command: "python3 ../backend/tools/mock_biostar.py --port 8092",
      url: "http://127.0.0.1:8092/",
      reuseExistingServer: true,
      timeout: 15_000,
    },
  ],
});
