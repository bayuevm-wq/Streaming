import { expect, test } from "@playwright/test";
import { signInAnonymously } from "./helpers";

// DIAGNOSTIK SEMENTARA (butir 5 review Fase 5): mengapa LCP album dan playlist ±4 detik di Lighthouse.
// Mengukur: (1) apakah isi utama ada di HTML awal atau hanya skeleton, (2) kapan h1 muncul di DOM dan kapan LCP,
// (3) kerja main-thread sebelum itu. Tidak diasersikan: hanya dicetak ("DIAG ..."). Dihapus setelah diagnosis.

const pages = async (page: import("@playwright/test").Page) => {
  const album = await page.locator("a[href^='/album/']").first().getAttribute("href");
  return [
    { name: "beranda", path: "/" },
    { name: "album", path: album! },
    { name: "playlist-indeks", path: "/playlist" },
  ];
};

test("diagnosis LCP", async ({ page, context }) => {
  test.setTimeout(180_000);
  await signInAnonymously(page);
  for (const p of await pages(page)) {
    // (1) HTML mentah (tanpa JavaScript)
    const html = await (await page.request.get(p.path)).text();
    const h1 = html.indexOf("<h1");
    const skeleton = html.indexOf("animate-pulse");
    const hasHiddenSuspense = /<div hidden id="S:\d+"/.test(html);
    console.log(`DIAG ${p.name} html: bytes=${html.length} h1@${h1} skeleton@${skeleton} suspenseTersembunyi=${hasHiddenSuspense} $RC=${html.includes("$RC")}`);
  }

  for (const cpu of [1, 4]) {
    for (const p of await pages(page)) {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
      await page.addInitScript(() => {
        (window as unknown as { __d: Record<string, number | string> }).__d = {};
        const d = (window as unknown as { __d: Record<string, number | string> }).__d;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) d.lcp = Math.round(e.startTime) + " " + ((e as unknown as { element?: Element }).element?.tagName ?? "");
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new MutationObserver(() => {
          if (!d.h1 && document.querySelector("main h1")) d.h1 = Math.round(performance.now());
          if (!d.p && document.querySelector("main p")) d.p = Math.round(performance.now());
        }).observe(document.documentElement, { childList: true, subtree: true });
        let long = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) long += e.duration;
          d.longTasksMs = Math.round(long);
        }).observe({ type: "longtask", buffered: true });
      });
      await page.goto(p.path, { waitUntil: "load" });
      await page.waitForTimeout(2500);
      const r = await page.evaluate(() => {
        const d = (window as unknown as { __d: Record<string, number | string> }).__d;
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime;
        return { ...d, fcp: fcp && Math.round(fcp), domInteractive: Math.round(nav.domInteractive), responseEnd: Math.round(nav.responseEnd), load: Math.round(nav.loadEventEnd), hydratedAt: document.documentElement.dataset.hydrated };
      });
      console.log(`DIAG ${p.name} cpu=${cpu}x ${JSON.stringify(r)}`);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      await cdp.detach();
    }
  }
  expect(true).toBe(true);
});
