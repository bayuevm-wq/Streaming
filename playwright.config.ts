import { defineConfig, devices } from "@playwright/test";

// E2E terhadap build produksi + Supabase lokal (lihat .github/workflows/e2e.yml).
// - "chrome": Google Chrome yang sudah terpasang (channel "chrome"); menjalankan semua spesifikasi KECUALI webkit-*.
// - "webkit": WebKit bawaan Playwright, hanya spesifikasi webkit-*.spec.ts (spike S4: kebijakan autoplay setelah await).
//   WebKit desktop BUKAN Safari iOS: iOS tetap harus diuji manual (docs/architecture.md 14.1, S4).
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
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chrome", use: { channel: "chrome" }, testIgnore: /webkit-.*\.spec\.ts/ },
    { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 800 } }, testMatch: /webkit-.*\.spec\.ts/ },
  ],
});
