import { expect, test, type Page } from "@playwright/test";
import { playerRegion, sampleAudio, signInAnonymously, waitForPlayback, waitHydrated } from "./helpers";
import { silentMp3, uploadOk } from "./upload-helpers";

// Spike S4 (docs/architecture.md 14.1): apakah putar pertama lagu pribadi lolos di WebKit setelah `await createSignedUrl`,
// dan apakah jalur sinkron (URL pra-ambil) lolos? Berjalan HANYA di project "webkit". WebKit desktop BUKAN Safari iOS:
// iOS punya aturan autoplay yang lebih ketat dan tetap harus diuji manual setelah deploy.
//
// Yang DIASERSIKAN: lagu katalog, jalur sinkron (tanpa permintaan signed URL saat diketuk), seek, dan next pada lagu ter-cache.
// Yang hanya DICATAT (baris "S4 HASIL"): jalur lambat (play() setelah await signed URL), karena itulah pertanyaan spike.

const SIGN = "/storage/v1/object/sign/user-audio";
const result = (key: string, value: string | number | boolean) => {
  console.log(`S4 HASIL ${key}=${value}`);
  test.info().annotations.push({ type: `S4 ${key}`, description: String(value) });
};

async function startedWithin(page: Page, ms: number): Promise<boolean> {
  try {
    await expect.poll(async () => (await sampleAudio(page)).t, { timeout: ms }).toBeGreaterThan(0.5);
    return true;
  } catch {
    return false;
  }
}

test("S4 WebKit: katalog, lagu pribadi (jalur sinkron), seek, next, dan jalur lambat", async ({ page, browserName }) => {
  test.setTimeout(180_000);
  expect(browserName).toBe("webkit");
  let signCount = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes(SIGN)) signCount++;
  });

  await signInAnonymously(page);
  const mp3 = await page.evaluate(() => document.createElement("audio").canPlayType("audio/mpeg"));
  result("canPlayType_audio_mpeg", mp3 || "(kosong)");
  test.skip(!mp3, "WebKit build ini tidak bisa memutar audio/mpeg: S4 tidak dapat diukur di sini (dicatat apa adanya)");

  await test.step("lagu katalog diputar", async () => {
    await page.getByRole("button", { name: /^Putar e2e Lagu/ }).first().click();
    await waitForPlayback(page);
    result("katalog_play", true);
  });

  await test.step("siapkan dua lagu pribadi", async () => {
    await uploadOk(page, { title: "S4 Pribadi A", bytes: silentMp3(40) });
    await uploadOk(page, { title: "S4 Pribadi B", bytes: silentMp3(41) });
  });

  await test.step("jalur sinkron: URL pra-ambil, tanpa permintaan signed URL saat diketuk", async () => {
    signCount = 0;
    await page.goto("/library"); // muat penuh: cache kosong, daftar memicu pra-ambil untuk kedua lagu
    await waitHydrated(page);
    await waitHydrated(page);
    await expect(page.getByRole("button", { name: "Putar S4 Pribadi A" })).toBeVisible();
    await expect.poll(() => signCount, { timeout: 20_000, message: "pra-ambil signed URL tidak terjadi" }).toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(500);
    const before = signCount;
    // daftar library terbaru dulu (B di atas A): mulai dari B, lalu "next" ke A
    await page.getByRole("button", { name: "Putar S4 Pribadi B" }).click();
    await waitForPlayback(page);
    expect(signCount, "ketukan putar tidak boleh memicu permintaan signed URL baru (jalur sinkron)").toBe(before);
    result("pribadi_sinkron_play", true);

    // next ke lagu pribadi ter-cache
    await playerRegion(page).getByRole("button", { name: "Lagu berikutnya" }).click();
    await expect(playerRegion(page).getByText("S4 Pribadi A", { exact: true }).first()).toBeVisible();
    await waitForPlayback(page, 0.3);
    result("next_ke_pribadi_cache", true);
  });

  await test.step("seek dengan keyboard pada slider", async () => {
    await playerRegion(page).getByRole("button", { name: "Jeda" }).click();
    await expect.poll(async () => (await sampleAudio(page)).paused).toBe(true);
    const before = await sampleAudio(page);
    const slider = playerRegion(page).getByRole("slider", { name: "Posisi lagu" });
    await slider.focus();
    for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await sampleAudio(page)).t).toBeGreaterThanOrEqual(Math.floor(before.t) + 5);
    result("seek", true);
  });

  // JALUR LAMBAT: playlist berisi dua lagu pribadi; dibuka lewat muat penuh (cache kosong) dan TrackList tidak pra-ambil,
  // sehingga putar pertama = ketukan -> await signed URL -> play(). Inilah skenario risiko Safari.
  await test.step("jalur lambat (dicatat, tidak diasersikan)", async () => {
    // buat playlist lewat dialog "Tambahkan ke playlist" lalu isi dengan kedua lagu
    await page.goto("/library");
    await waitHydrated(page);
    await page.getByRole("button", { name: "Tambahkan S4 Pribadi A ke playlist" }).click();
    await page.getByRole("dialog", { name: "Tambahkan ke playlist" }).getByRole("button", { name: "Playlist baru" }).click();
    const create = page.getByRole("dialog", { name: "Playlist baru" });
    await create.getByLabel("Nama playlist").fill("S4 Playlist");
    await create.getByRole("button", { name: "Buat playlist" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "S4 Playlist" })).toBeVisible();
    const playlistUrl = page.url();
    await page.goto("/library");
    await waitHydrated(page);
    for (const t of ["S4 Pribadi A", "S4 Pribadi B"]) {
      await page.getByRole("button", { name: `Tambahkan ${t} ke playlist` }).click();
      await page.getByRole("dialog", { name: "Tambahkan ke playlist" }).getByRole("button", { name: /S4 Playlist/ }).click();
      await expect(page.getByText(`“${t}” ditambahkan ke “S4 Playlist”.`)).toBeVisible();
    }
    await page.goto(playlistUrl); // muat penuh: cache pra-ambil kosong, dan TrackList tidak memanggil prefetch
    await waitHydrated(page);
    await waitHydrated(page); // tanpa ini klik bisa jatuh sebelum React memasang penangan (hasil pengukuran jadi palsu)
    await expect(page.getByRole("button", { name: "Putar S4 Pribadi A" })).toBeVisible();

    signCount = 0;
    await page.getByRole("button", { name: "Putar S4 Pribadi A" }).click();
    const started = await startedWithin(page, 15_000);
    result("lambat_putar_pertama_signCount", signCount);
    result("lambat_putar_pertama_mulai", started);
    if (started) {
      await page.waitForTimeout(500);
      signCount = 0;
      await playerRegion(page).getByRole("button", { name: "Lagu berikutnya" }).click();
      const second = await startedWithin(page, 15_000);
      result("lambat_next_pribadi_mulai", second);
    }
  });
});
