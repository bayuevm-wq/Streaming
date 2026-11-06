import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { playerRegion, signInAnonymously, waitForPlayback } from "./helpers";

// Tangkapan layar untuk ditinjau manusia (diunggah sebagai artefak CI) + pemeriksaan tak ada scroll horizontal.
const OUT = "test-results/shots/fase2";

for (const vp of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "ponsel", width: 390, height: 844 },
]) {
  test(`halaman utama pada ${vp.name} (${vp.width}px): tangkapan layar dan tanpa scroll horizontal`, async ({ page }) => {
    fs.mkdirSync(OUT, { recursive: true });
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await signInAnonymously(page);
    await page.getByRole("button", { name: /^Putar e2e Lagu/ }).first().click();
    await waitForPlayback(page);
    await expect(playerRegion(page)).toBeVisible();

    const noHScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && document.body.scrollWidth <= window.innerWidth + 1);
    await page.screenshot({ path: `${OUT}/${vp.name}-beranda.png` });
    await playerRegion(page).screenshot({ path: `${OUT}/${vp.name}-${vp.width <= 760 ? "mini-player" : "player-bar"}.png` }); // pemutar di dasar layar
    expect(await noHScroll(), "beranda: scroll horizontal").toBe(true);

    await page.getByRole("region", { name: "Album" }).getByRole("link").first().click();
    await page.waitForURL((u) => /^\/album\//.test(u.pathname));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${vp.name}-album.png` });
    expect(await noHScroll(), "album: scroll horizontal").toBe(true);

    await page.locator("main header a[href^='/artis/']").first().click();
    await page.waitForURL((u) => /^\/artis\//.test(u.pathname));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${vp.name}-artis.png` });
    expect(await noHScroll(), "artis: scroll horizontal").toBe(true);

    if (vp.width <= 760) {
      // Ponsel: mini-player -> pemutar penuh -> antrean
      await playerRegion(page).getByRole("button", { name: /^Buka pemutar/ }).click();
      const full = page.getByRole("dialog", { name: "Pemutar" });
      await expect(full).toBeVisible();
      await page.screenshot({ path: `${OUT}/${vp.name}-pemutar-penuh.png` });
      await full.getByRole("button", { name: "Antrean" }).click();
    } else {
      await playerRegion(page).getByRole("button", { name: "Buka antrean" }).click();
    }
    await expect(page.getByRole("dialog", { name: "Antrean" })).toBeVisible();
    await page.screenshot({ path: `${OUT}/${vp.name}-antrean.png` });
  });
}
