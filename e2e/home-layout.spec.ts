import { expect, test, type Locator, type Page } from "@playwright/test";
import { playerRegion, signInAnonymously, waitForPlayback, waitHydrated } from "./helpers";

// Tata letak beranda (review katalog dan kredit): Album di atas Lagu Terbaru; di ponsel (<= 640px) lagu tampil sebagai ubin
// 2 kolom dan album sebagai baris geser, sehingga >= 4 lagu terlihat di layar pertama. Data CI: 6 lagu, 2 album, 2 artis.

const box = async (l: Locator) => (await l.boundingBox())!;
const cards = (page: Page) => page.getByRole("region", { name: "Lagu Terbaru" }).getByRole("article");

/** Jumlah kartu yang SELURUHNYA berada di atas `limit` (tepi atas navigasi bawah atau mini-player). */
async function fullyVisible(items: Locator, limit: number) {
  let n = 0;
  for (const c of await items.all()) {
    const b = await box(c);
    if (b.y >= 0 && b.y + b.height <= limit) n++;
  }
  return n;
}

test("ponsel: Album di atas Lagu Terbaru, lagu 2 kolom, minimal 4 lagu terlihat penuh di layar pertama (juga saat pemutar aktif)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAnonymously(page);
  await waitHydrated(page);
  await expect(cards(page)).toHaveCount(6);

  // urutan bagian: Album lalu Lagu Terbaru
  const albumH = await box(page.getByRole("heading", { level: 2, name: "Album" }));
  const songsH = await box(page.getByRole("heading", { level: 2, name: "Lagu Terbaru" }));
  expect(albumH.y, "Album harus di atas Lagu Terbaru").toBeLessThan(songsH.y);

  // album: baris geser horizontal (snap), kartu selebar 9rem; halaman tidak punya scroll horizontal
  const strip = page.getByRole("region", { name: "Album" }).locator(":scope > div");
  const s = await strip.evaluate((el) => ({ ox: getComputedStyle(el).overflowX, snap: getComputedStyle(el).scrollSnapType, display: getComputedStyle(el).display }));
  expect(s.ox).toBe("auto");
  expect(s.snap).toContain("x");
  expect(s.display).toBe("flex");
  expect((await box(strip.getByRole("article").first())).width).toBeCloseTo(144, 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "scroll horizontal pada halaman").toBe(true);

  // lagu: 2 kolom, ubin ringkas
  const list = cards(page);
  const [c1, c2, c3] = await Promise.all([box(list.nth(0)), box(list.nth(1)), box(list.nth(2))]);
  expect(Math.abs(c1.y - c2.y), "kartu 1 dan 2 harus sebaris").toBeLessThan(2);
  expect(c2.x, "kartu 2 di kolom kanan").toBeGreaterThan(c1.x + c1.width / 2);
  expect(c3.y, "kartu 3 di baris berikutnya").toBeGreaterThan(c1.y + c1.height - 1);
  expect(c1.height, "ubin ringkas (bukan kartu persegi penuh-layar)").toBeLessThan(100);

  // >= 4 lagu terlihat penuh di atas navigasi bawah
  const nav = await box(page.getByRole("navigation", { name: "Utama" }));
  const n1 = await fullyVisible(list, nav.y);
  expect(n1, `lagu terlihat penuh di layar pertama (batas y=${nav.y})`).toBeGreaterThanOrEqual(4);

  // dengan mini-player aktif (memakan tinggi layar) tetap >= 4
  await page.getByRole("button", { name: /^Putar e2e Lagu/ }).first().click();
  await waitForPlayback(page);
  const mini = await box(playerRegion(page));
  const n2 = await fullyVisible(list, mini.y);
  expect(n2, `lagu terlihat penuh dengan mini-player (batas y=${mini.y})`).toBeGreaterThanOrEqual(4);

  // tombol putar pada ubin tetap bisa disentuh (>= 24px, WCAG 2.5.8)
  const play = await box(page.getByRole("button", { name: /^(Putar|Jeda) e2e Lagu/ }).first());
  expect(Math.min(play.width, play.height)).toBeGreaterThanOrEqual(24);
});

test("desktop: Album di atas Lagu Terbaru, kartu lagu tetap persegi (bukan ubin ringkas)", async ({ page }) => {
  await signInAnonymously(page);
  await waitHydrated(page);
  const albumH = await box(page.getByRole("heading", { level: 2, name: "Album" }));
  const songsH = await box(page.getByRole("heading", { level: 2, name: "Lagu Terbaru" }));
  expect(albumH.y).toBeLessThan(songsH.y);
  const c = await box(cards(page).first());
  expect(c.height, "kartu desktop berbentuk persegi dengan sampul besar").toBeGreaterThan(150);
  const strip = page.getByRole("region", { name: "Album" }).locator(":scope > div");
  expect(await strip.evaluate((el) => getComputedStyle(el).display), "di desktop album berupa grid, bukan baris geser").toBe("grid");
});

test("ponsel: tautan Kredit di bawah beranda membuka /kredit", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAnonymously(page);
  await waitHydrated(page);
  const link = page.getByRole("link", { name: "Lihat kredit musik" });
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL((u) => u.pathname === "/kredit");
  await expect(page.getByRole("heading", { level: 1, name: "Kredit" })).toBeVisible();
});
