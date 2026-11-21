import { expect, test } from "@playwright/test";
import { signInAnonymously, waitHydrated } from "./helpers";

// Kredit lagu katalog (CC BY dan CC BY-SA mewajibkan atribusi): halaman /kredit, kredit di halaman album, dan navigasi.
// Data CI adalah katalog sintetis (lisensi CC0 1.0, sumber https://example.com/berkas-uji-sintetis/...).

test("/kredit: dapat dibuka dari sidebar, memuat kredit tiap lagu dengan tautan sumber yang aman", async ({ page }) => {
  await signInAnonymously(page);
  await waitHydrated(page);
  await page.getByRole("complementary", { name: "Navigasi samping" }).getByRole("link", { name: "Kredit" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Kredit" })).toBeVisible();

  // ringkasan lisensi dengan tautan ke teks lisensi
  const deed = page.getByRole("link", { name: /^Teks lisensi CC0 1\.0/ });
  await expect(deed).toHaveAttribute("href", "https://creativecommons.org/publicdomain/zero/1.0/");
  await expect(deed).toHaveAttribute("rel", /noopener/);
  await expect(deed).toHaveAttribute("target", "_blank");

  // tiap lagu: teks kredit lengkap + tautan lisensi menuju halaman lagu di sumbernya
  const credits = page.getByTestId("credit-text");
  await expect(credits).toHaveCount(6);
  await expect(credits.first()).toContainText("e2e Lagu");
  const links = page.getByRole("link", { name: /^CC0 1\.0, halaman sumber lagu e2e Lagu/ });
  await expect(links).toHaveCount(6);
  for (const l of await links.all()) {
    await expect(l).toHaveAttribute("href", /^https:\/\/example\.com\/berkas-uji-sintetis\/e2e-\d$/);
    await expect(l).toHaveAttribute("target", "_blank");
    await expect(l).toHaveAttribute("rel", /noopener/);
  }
  // pengelompokan per album
  await expect(page.getByRole("heading", { level: 2, name: "e2e Album Satu" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "e2e Album Dua" })).toBeVisible();
});

test("halaman album menampilkan kredit lagunya dan menaut ke /kredit", async ({ page }) => {
  await signInAnonymously(page);
  await page.getByRole("region", { name: "Album" }).getByRole("link").first().click();
  await page.waitForURL((u) => /^\/album\//.test(u.pathname));
  const section = page.getByRole("region", { name: "Kredit" });
  await expect(section).toBeVisible();
  const first = section.getByRole("listitem").first();
  await expect(first).toContainText("e2e Lagu");
  await expect(first.getByRole("link", { name: /^CC0 1\.0, halaman sumber lagu/ })).toHaveAttribute("href", /^https:\/\/example\.com\/berkas-uji-sintetis\//);
  await section.getByRole("link", { name: "halaman Kredit" }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/kredit");
  await expect(page.getByRole("heading", { level: 1, name: "Kredit" })).toBeVisible();
});

test("ponsel: navigasi bawah maksimal 5 tab tanpa Kredit; Kredit ada di menu atas (Esc menutup, fokus kembali)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAnonymously(page);
  await waitHydrated(page);
  const nav = page.getByRole("navigation", { name: "Utama" });
  const links = nav.getByRole("link");
  await expect(links).toHaveCount(5);
  await expect(links).toHaveText(["Beranda", "Cari", "Library", "Playlist", "Disukai"]);
  await expect(nav.getByRole("link", { name: "Kredit" })).toHaveCount(0);
  for (const l of await links.all()) expect((await l.boundingBox())?.height ?? 0, "target sentuh navigasi bawah >= 56px").toBeGreaterThanOrEqual(56);

  // menu atas: tombol Menu membuka popover berisi Kredit dan Keluar
  const menuButton = page.getByRole("button", { name: "Menu" });
  expect((await menuButton.boundingBox())?.width ?? 0, "target sentuh tombol Menu >= 44px").toBeGreaterThanOrEqual(44);
  const menu = page.getByRole("navigation", { name: "Menu atas" });
  await expect(menu).toBeHidden();
  await menuButton.click();
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link", { name: "Kredit" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Keluar" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(menuButton).toBeFocused(); // fokus kembali ke pemicu

  // Kredit lewat menu atas: popover menutup, halaman terbuka, tanpa scroll horizontal
  await menuButton.click();
  await menu.getByRole("link", { name: "Kredit" }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/kredit");
  await expect(page.getByRole("heading", { level: 1, name: "Kredit" })).toBeVisible();
  await expect(menu).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "scroll horizontal di /kredit").toBe(true);
  await expect(page.getByTestId("credit-text").first()).toBeVisible();

  // Keluar lewat menu atas: dialog konfirmasi tampil (di luar popover) dan Batal menutupnya
  await menuButton.click();
  await menu.getByRole("button", { name: "Keluar" }).click();
  const dialog = page.getByRole("dialog", { name: "Keluar dari mode tamu?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Batal" }).click();
  await expect(dialog).toBeHidden();
});
