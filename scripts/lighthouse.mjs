// Lighthouse terhadap build produksi yang sedang berjalan (mobile: emulasi ponsel + throttling simulasi bawaan).
// Halaman area login butuh sesi, jadi Chrome dijalankan lewat Playwright dengan profil persisten dan port debugging;
// Lighthouse tersambung ke Chrome yang SAMA sehingga cookie sesi anonim ikut terbawa.
//
//   BASE_URL=http://127.0.0.1:3000 node scripts/lighthouse.mjs
//
// Ambang (spec: Lighthouse beranda mobile Performance >= 85 dan Accessibility >= 90):
//   - beranda: Performance >= 0.85 dan Accessibility >= 0.90 (GAGAL bila kurang)
//   - halaman lain: Accessibility >= 0.90 (GAGAL bila kurang); Performance hanya dilaporkan
// Skor Performance bervariasi antar run (runner CI bersama); skrip mengambil MEDIAN dari 3 run per halaman.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const OUT = "test-results/lighthouse";
const PORT = 9333;
const RUNS = 3;
fs.mkdirSync(OUT, { recursive: true });

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-"));
const context = await chromium.launchPersistentContext(userDataDir, {
  channel: "chrome",
  headless: true,
  args: [`--remote-debugging-port=${PORT}`],
});
const page = context.pages()[0] ?? (await context.newPage());

// masuk anonim (Turnstile kunci uji)
await page.goto(`${BASE}/masuk`);
await page.getByRole("button", { name: "Coba tanpa daftar" }).click();
await page.waitForURL((u) => u.pathname === "/", { timeout: 45_000 });
await page.getByRole("heading", { level: 1, name: "Beranda" }).waitFor();

// halaman yang diaudit: id album dan artis diambil dari beranda
const albumHref = await page.locator("a[href^='/album/']").first().getAttribute("href");
const artistHref = await page.locator("a[href^='/artis/']").first().getAttribute("href");
const pages = [
  { name: "beranda", path: "/", strict: true },
  { name: "album", path: albumHref },
  { name: "artis", path: artistHref },
  { name: "pencarian", path: "/cari?q=Lagu" },
  { name: "library", path: "/library" },
  { name: "unggah", path: "/unggah" },
  { name: "playlist", path: "/playlist" },
].filter((p) => p.path);

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const rows = [];
const failures = [];

for (const p of pages) {
  const perf = [];
  const a11y = [];
  const bp = [];
  let last;
  for (let i = 0; i < RUNS; i++) {
    const res = await lighthouse(`${BASE}${p.path}`, { port: PORT, output: "json", logLevel: "error", onlyCategories: ["performance", "accessibility", "best-practices"] });
    last = res.lhr;
    perf.push(last.categories.performance.score ?? 0);
    a11y.push(last.categories.accessibility.score ?? 0);
    bp.push(last.categories["best-practices"].score ?? 0);
  }
  fs.writeFileSync(`${OUT}/${p.name}.json`, JSON.stringify(last, null, 2));
  const row = { page: p.name, perf: median(perf), a11y: median(a11y), bp: median(bp), perfRuns: perf, lcp: last.audits["largest-contentful-paint"].displayValue, tbt: last.audits["total-blocking-time"].displayValue, cls: last.audits["cumulative-layout-shift"].displayValue };
  rows.push(row);
  // auditan aksesibilitas yang gagal, untuk diperbaiki
  const failed = Object.values(last.audits).filter((a) => last.categories.accessibility.auditRefs.some((r) => r.id === a.id) && a.score !== null && a.score < 1 && a.scoreDisplayMode !== "notApplicable" && a.scoreDisplayMode !== "manual");
  row.failedA11y = failed.map((a) => a.id);
  if (row.a11y < 0.9) failures.push(`${p.name}: Accessibility ${row.a11y} < 0.90 (${row.failedA11y.join(", ")})`);
  if (p.strict && row.perf < 0.85) failures.push(`${p.name}: Performance ${row.perf} < 0.85 (run: ${perf.join(", ")})`);
}

await context.close();

const pct = (x) => Math.round(x * 100);
const md = [
  `| Halaman | Performance (median ${RUNS} run) | Accessibility | Best Practices | LCP | TBT | CLS |`,
  "|---|---|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.page} | ${pct(r.perf)} (${r.perfRuns.map(pct).join(", ")}) | ${pct(r.a11y)} | ${pct(r.bp)} | ${r.lcp} | ${r.tbt} | ${r.cls} |`),
].join("\n");
fs.writeFileSync(`${OUT}/ringkasan.md`, md + "\n");
console.log(md);
for (const r of rows) if (r.failedA11y.length) console.log(`a11y ${r.page}: ${r.failedA11y.join(", ")}`);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Lighthouse (mobile)\n\n${md}\n`);

if (failures.length) {
  console.error(`\nLIGHTHOUSE GAGAL:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nLIGHTHOUSE LULUS");
