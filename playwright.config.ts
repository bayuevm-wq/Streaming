import { defineConfig } from "@playwright/test";

// E2E terhadap build produksi + Supabase lokal (lihat .github/workflows/e2e.yml).
// Memakai Google Chrome yang sudah terpasang (channel "chrome"), sehingga tidak perlu mengunduh browser Playwright.
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  outputDir: "test-results/artifacts",
  use: {
    baseURL: process.env.BASE_URL ?? "http://127.0.0.1:3000",
    channel: "chrome",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
