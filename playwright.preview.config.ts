import { defineConfig } from "@playwright/test";

// Pratinjau tangkapan layar dengan katalog asli (workflow screenshots-katalog). Terpisah dari suite E2E biasa
// (playwright.config.ts) karena bergantung pada database yang di-seed dengan katalog asli, bukan katalog sintetis.
export default defineConfig({
  testDir: "./e2e-preview",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "test-results/artifacts-preview",
  use: { baseURL: process.env.BASE_URL ?? "http://127.0.0.1:3000", channel: "chrome", trace: "retain-on-failure" },
});
