import { expect, test } from "@playwright/test";
import { markPage, playerRegion, sampleAudio, signInAnonymously, waitForPlayback } from "./helpers";

// Ponsel (<= 760px): sidebar dan player bar digantikan MiniPlayer + BottomNav. Sebelumnya keduanya (plus tab atas)
// memakan sekitar 220px tinggi layar; sasaran sekarang < 130px. Audio tidak boleh terputus oleh navigasi bawah.
test.use({ viewport: { width: 390, height: 844 } });

test("ponsel: mini-player + navigasi bawah < 130px, audio tetap berjalan, pemutar penuh bisa dipakai keyboard", async ({ page }) => {
  await signInAnonymously(page);
  await page.getByRole("button", { name: /^Putar e2e Lagu/ }).first().click();
  await waitForPlayback(page);
  await markPage(page);

  const mini = playerRegion(page);
  const nav = page.getByRole("navigation", { name: "Utama" });
  await expect(mini).toBeVisible();
  await expect(nav).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Navigasi samping" })).toBeHidden(); // sidebar hilang

  const [mb, nb] = await Promise.all([mini.boundingBox(), nav.boundingBox()]);
  const used = (mb?.height ?? 999) + (nb?.height ?? 999);
  expect(used, `mini-player ${mb?.height} + navigasi bawah ${nb?.height} px`).toBeLessThan(130);
  expect(nb?.height ?? 0, "target sentuh navigasi bawah >= 56px").toBeGreaterThanOrEqual(56);

  // navigasi bawah: audio tidak terputus, item aktif bertanda aria-current
  const first = await sampleAudio(page);
  let prev = first;
  for (const name of ["Library", "Disukai", "Beranda"]) {
    await nav.getByRole("link", { name }).click();
    await page.waitForTimeout(1800);
    const s = await sampleAudio(page);
    expect(s.marker, `${name}: halaman dimuat ulang penuh`).toBe("tetap");
    expect(s.paused, `${name}: audio berhenti`).toBe(false);
    expect(s.src).toBe(first.src);
    expect(s.t, `${name}: currentTime tidak naik`).toBeGreaterThan(prev.t + 1.0);
    await expect(nav.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
    prev = s;
  }

  // pemutar penuh
  await mini.getByRole("button", { name: /^Buka pemutar/ }).click();
  const full = page.getByRole("dialog", { name: "Pemutar" });
  await expect(full).toBeVisible();
  await full.getByRole("button", { name: "Jeda" }).click();
  await expect.poll(async () => (await sampleAudio(page)).paused).toBe(true);
  const before = await sampleAudio(page);
  const slider = full.getByRole("slider", { name: "Posisi lagu" });
  await slider.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await sampleAudio(page)).t).toBeGreaterThanOrEqual(Math.floor(before.t) + 5);
  await expect(slider).toHaveAttribute("aria-valuetext", /^\d+:\d{2} dari \d+:\d{2}$/);

  await page.keyboard.press("Escape"); // dialog asli: Esc menutup
  await expect(full).toBeHidden();
  const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(noHScroll, "scroll horizontal di ponsel").toBe(true);
});
