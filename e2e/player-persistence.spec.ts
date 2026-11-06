import { expect, test, type Page } from "@playwright/test";
import { markPage, playerRegion, sampleAudio, signInAnonymously, waitForPlayback } from "./helpers";

// Spec F2: pemutar tidak boleh berhenti atau mengulang saat pengguna berpindah halaman. Elemen audio hidup di layout (app)
// dan tidak ikut unmount. Lagu uji (MP3 sunyi sintetis 90 dtk) sengaja lebih panjang dari seluruh uji.

const playFirstSong = async (page: Page) => {
  await page.getByRole("button", { name: /^Putar e2e Lagu/ }).first().click();
  await waitForPlayback(page);
};

test("currentTime terus naik saat berpindah antar rute internal (F2)", async ({ page }) => {
  await signInAnonymously(page);
  await playFirstSong(page);
  await markPage(page);

  const player = playerRegion(page);
  await expect(player).toBeVisible();
  const title = (await player.locator("p.font-display").first().textContent())?.trim() ?? "";
  expect(title).toMatch(/^e2e Lagu/);

  const first = await sampleAudio(page);
  expect(first.paused).toBe(false);
  expect(first.audioTags, "audio singleton tidak boleh berupa elemen <audio> di DOM").toBe(0);
  let prev = first;

  const nav = page.getByRole("navigation", { name: "Utama" }).first();
  const steps: { name: string; go: () => Promise<void>; path: RegExp }[] = [
    { name: "Beranda -> Library (sidebar)", go: () => nav.getByRole("link", { name: "Library" }).click(), path: /^\/library$/ },
    { name: "Library -> Lagu Disukai (sidebar)", go: () => nav.getByRole("link", { name: "Lagu Disukai" }).click(), path: /^\/disukai$/ },
    { name: "Lagu Disukai -> Beranda (sidebar)", go: () => nav.getByRole("link", { name: "Beranda" }).click(), path: /^\/$/ },
    { name: "Beranda -> halaman album (kartu)", go: () => page.getByRole("region", { name: "Album" }).getByRole("link").first().click(), path: /^\/album\/[0-9a-f-]{36}$/ },
    { name: "Album -> halaman artis (tautan artis)", go: () => page.locator("main header a[href^='/artis/']").first().click(), path: /^\/artis\/[0-9a-f-]{36}$/ },
    { name: "Artis -> Beranda (sidebar)", go: () => nav.getByRole("link", { name: "Beranda" }).click(), path: /^\/$/ },
  ];

  for (const step of steps) {
    await step.go();
    await page.waitForURL((u) => step.path.test(u.pathname), { timeout: 30_000 });
    await page.waitForTimeout(2000);
    const cur = await sampleAudio(page);
    const why = (m: string) => `${step.name}: ${m}`;
    expect(cur.marker, why("halaman dimuat ulang penuh (penanda hilang)")).toBe("tetap");
    expect(cur.sameElement, why("elemen audio berganti")).toBe(true);
    expect(cur.audioTags, why("ada elemen <audio> di DOM")).toBe(0);
    expect(cur.src, why("sumber audio berganti")).toBe(first.src);
    expect(cur.paused, why("audio berhenti")).toBe(false);
    expect(cur.ended, why("lagu berakhir")).toBe(false);
    expect(cur.t, why(`currentTime tidak naik (${prev.t.toFixed(2)} -> ${cur.t.toFixed(2)})`)).toBeGreaterThan(prev.t + 1.2);
    await expect(playerRegion(page), why("player bar hilang")).toBeVisible();
    await expect(playerRegion(page).getByText(title, { exact: true }), why("judul di player bar berubah")).toBeVisible();
    prev = cur;
  }
  expect(prev.t, "total pemutaran sepanjang uji").toBeGreaterThan(first.t + 6 * 1.2);
});

test("jeda tetap jeda saat berpindah rute, dan lanjut dari posisi yang sama", async ({ page }) => {
  await signInAnonymously(page);
  await playFirstSong(page);
  await markPage(page);

  await playerRegion(page).getByRole("button", { name: "Jeda" }).click();
  await expect.poll(async () => (await sampleAudio(page)).paused).toBe(true);
  const paused = await sampleAudio(page);

  await page.getByRole("navigation", { name: "Utama" }).first().getByRole("link", { name: "Library" }).click();
  await page.waitForURL((u) => u.pathname === "/library");
  await page.waitForTimeout(1500);
  const after = await sampleAudio(page);
  expect(after.marker).toBe("tetap");
  expect(after.paused, "audio tidak boleh menyala sendiri setelah pindah rute").toBe(true);
  expect(Math.abs(after.t - paused.t)).toBeLessThan(0.1);

  await playerRegion(page).getByRole("button", { name: "Putar" }).click();
  await expect.poll(async () => (await sampleAudio(page)).t, { timeout: 15_000 }).toBeGreaterThan(paused.t + 0.8);
  expect((await sampleAudio(page)).src).toBe(paused.src);
});

test('klik "Lagu berikutnya" cepat dua kali: hanya satu sumber yang berjalan (tanpa audio ganda)', async ({ page }) => {
  await signInAnonymously(page);
  const titles = (await page.getByRole("region", { name: "Lagu Terbaru" }).locator("h3").allTextContents()).map((t) => t.trim());
  expect(titles.length).toBeGreaterThanOrEqual(3);

  await page.getByRole("button", { name: `Putar ${titles[0]}` }).click();
  await waitForPlayback(page);
  await markPage(page);

  const next = playerRegion(page).getByRole("button", { name: "Lagu berikutnya" });
  await next.click();
  await next.click();
  await expect(playerRegion(page).getByText(titles[2], { exact: true })).toBeVisible();
  await page.waitForTimeout(2500);

  const a = await sampleAudio(page);
  expect(a.sameElement).toBe(true);
  expect(a.audioTags).toBe(0);
  expect(a.paused).toBe(false);
  const b = await (async () => {
    await page.waitForTimeout(1500);
    return sampleAudio(page);
  })();
  expect(b.src, "sumber audio berubah sendiri: hasil permintaan usang menimpa").toBe(a.src);
  expect(b.t).toBeGreaterThan(a.t + 0.8);
  await expect(playerRegion(page).getByText(titles[2], { exact: true })).toBeVisible();
});

test("slider posisi: Tab + panah kanan memajukan audio sungguhan", async ({ page }) => {
  await signInAnonymously(page);
  await playFirstSong(page);
  await playerRegion(page).getByRole("button", { name: "Jeda" }).click(); // jeda agar currentTime hanya berubah oleh seek
  await expect.poll(async () => (await sampleAudio(page)).paused).toBe(true);
  const before = await sampleAudio(page);

  const slider = playerRegion(page).getByRole("slider", { name: "Posisi lagu" });
  await slider.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await sampleAudio(page)).t).toBeGreaterThanOrEqual(Math.floor(before.t) + 5);
  await expect(slider).toHaveAttribute("aria-valuetext", /^\d+:\d{2} dari \d+:\d{2}$/);

  await page.keyboard.press("Home");
  await expect.poll(async () => (await sampleAudio(page)).t).toBeLessThan(0.5);
});

test("ID tidak valid: 404 rapi di dalam kerangka aplikasi", async ({ page }) => {
  await signInAnonymously(page);
  // Catatan: status HTTP-nya 200, bukan 404. Halaman di-stream di balik Suspense (loading.tsx), sehingga status sudah
  // terkirim sebelum notFound() dijalankan. Yang dijamin spec F4 adalah halaman 404 yang rapi (tampilan), bukan kode status.
  await page.goto("/album/bukan-uuid");
  await expect(page.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
  // tetap di dalam kerangka: sidebar dan pencarian ada
  await expect(page.getByRole("navigation", { name: "Utama" }).first()).toBeVisible();
  await expect(page.getByRole("search")).toBeVisible();
});
