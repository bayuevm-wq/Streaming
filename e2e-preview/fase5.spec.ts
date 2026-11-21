import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { signInAnonymously, waitHydrated } from "../e2e/helpers";

// Tangkapan layar Fase 5 dengan data seed ASLI (metadata, kredit, sampul, dan durasi dari scripts/seed/catalog.json).
// Audio di CI adalah pengganti sunyi; hanya metadata yang tampak. Keluaran: test-results/shots/fase5/.
const OUT = "test-results/shots/fase5";

for (const vp of [
  { name: "desktop", width: 1280, height: 800, tall: 2300 },
  { name: "ponsel", width: 390, height: 844, tall: 4200 },
]) {
  test(`katalog asli: beranda, album, dan /kredit pada ${vp.name} (${vp.width}px)`, async ({ page }) => {
    fs.mkdirSync(OUT, { recursive: true });
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await signInAnonymously(page);
    await waitHydrated(page);
    const noHScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

    // beranda dengan katalog asli
    await expect(page.getByRole("heading", { level: 1, name: "Beranda" })).toBeVisible();
    await expect(page.getByText("Kevin MacLeod").first()).toBeVisible();
    await page.waitForTimeout(1000); // sampul selesai dimuat
    await page.screenshot({ path: `${OUT}/${vp.name}-beranda.png` });
    expect(await noHScroll(), "beranda: scroll horizontal").toBe(true);

    // beranda utuh (viewport tinggi): Album, Lagu Terbaru, Artis, dan tautan kredit di dasar
    await page.setViewportSize({ width: vp.width, height: vp.tall });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${vp.name}-beranda-lengkap.png` });
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(300);

    // ponsel: menu atas terbuka (Kredit dan Keluar), tempat Kredit sekarang
    if (vp.width <= 760) {
      await page.getByRole("button", { name: "Menu" }).click();
      await expect(page.getByRole("navigation", { name: "Menu atas" })).toBeVisible();
      await page.screenshot({ path: `${OUT}/${vp.name}-menu-atas.png` });
      await page.keyboard.press("Escape");
    }

    // album dengan lisensi campuran (CC BY dan CC BY-SA)
    await page.getByRole("link", { name: /FREE FOR YOU - CC BY/ }).first().click();
    await page.waitForURL((u) => /^\/album\//.test(u.pathname));
    await expect(page.getByRole("heading", { level: 1, name: "FREE FOR YOU - CC BY" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Kredit" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^CC BY-SA 4\.0, halaman sumber lagu/ }).first()).toBeVisible();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/${vp.name}-album.png` });
    // bagian kredit di dasar halaman album
    await page.getByRole("region", { name: "Kredit" }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${vp.name}-album-kredit.png` });
    expect(await noHScroll(), "album: scroll horizontal").toBe(true);

    // /kredit (layar standar lalu tinggi agar seluruh daftar tampak)
    await page.goto("/kredit");
    await waitHydrated(page);
    await expect(page.getByRole("heading", { level: 1, name: "Kredit" })).toBeVisible();
    await expect(page.getByTestId("credit-text")).toHaveCount(17);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${vp.name}-kredit.png` });
    await page.setViewportSize({ width: vp.width, height: vp.tall });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${vp.name}-kredit-lengkap.png` });
    expect(await noHScroll(), "kredit: scroll horizontal").toBe(true);

    // teks kredit Kevin MacLeod persis seperti Attribution Code resmi
    await expect(
      page.getByTestId("credit-text").filter({ hasText: "Kevin MacLeod (incompetech.com) Licensed under Creative Commons: By Attribution 4.0 License http://creativecommons.org/licenses/by/4.0/" }),
    ).toHaveCount(4);
  });
}
