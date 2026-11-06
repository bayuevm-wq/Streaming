import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { signInAnonymously, waitForPlayback, waitHydrated } from "./helpers";
import { fillAndSubmit, silentMp3, slots, uploadOk } from "./upload-helpers";

// Tangkapan layar Fase 3 (pencarian, Lagu Disukai, playlist) dan Fase 4 (library, unggah) untuk ditinjau manusia.
// Diunggah sebagai artefak CI; disalin ke docs/images/fase3 dan fase4 hanya lewat pembaruan manual (lihat docs/images/README).
const ROOT = "test-results/shots";

for (const vp of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "ponsel", width: 390, height: 844 },
]) {
  test(`tangkapan layar Fase 3 dan 4 pada ${vp.name} (${vp.width}px)`, async ({ page }) => {
    test.setTimeout(300_000);
    fs.mkdirSync(`${ROOT}/fase3`, { recursive: true });
    fs.mkdirSync(`${ROOT}/fase4`, { recursive: true });
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const shot = async (dir: "fase3" | "fase4", name: string) => {
      await page.waitForTimeout(700); // transisi selesai
      await page.screenshot({ path: `${ROOT}/${dir}/${vp.name}-${name}.png` });
    };
    const dismissToasts = async () => {
      for (const b of await page.getByRole("button", { name: "Tutup pesan" }).all()) await b.click().catch(() => undefined);
    };
    const noHScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

    await signInAnonymously(page);
    await page.getByRole("button", { name: /^Putar e2e Lagu/ }).first().click();
    await waitForPlayback(page);

    // ---------- Fase 3 ----------
    await page.goto("/cari?q=Lagu");
    await expect(page.getByRole("heading", { level: 1, name: "Hasil untuk “Lagu”" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Sukai e2e Lagu/ }).first()).toBeVisible();
    await shot("fase3", "pencarian");
    expect(await noHScroll(), "pencarian: scroll horizontal").toBe(true);

    // sukai dua lagu, lalu /disukai
    const likeButtons = page.getByRole("button", { name: /^Sukai e2e Lagu/ });
    await likeButtons.first().click();
    await expect(page.getByRole("button", { name: /^Batal suka e2e Lagu/ })).toHaveCount(1);
    await likeButtons.first().click();
    await expect(page.getByRole("button", { name: /^Batal suka e2e Lagu/ })).toHaveCount(2);
    await page.goto("/disukai");
    await expect(page.getByRole("heading", { level: 1, name: "Lagu Disukai" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Batal suka e2e Lagu/ }).first()).toBeVisible();
    await shot("fase3", "disukai");
    expect(await noHScroll(), "disukai: scroll horizontal").toBe(true);

    // playlist berisi dua lagu
    await page.goto("/cari?q=Lagu");
    await page.getByRole("button", { name: /^Tambahkan e2e Lagu .* ke playlist$/ }).first().click();
    await page.getByRole("dialog", { name: "Tambahkan ke playlist" }).getByRole("button", { name: "Playlist baru" }).click();
    const create = page.getByRole("dialog", { name: "Playlist baru" });
    await create.getByLabel("Nama playlist").fill("Teman perjalanan");
    await create.getByRole("button", { name: "Buat playlist" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Teman perjalanan" })).toBeVisible();
    const playlistUrl = page.url();
    await page.goto("/cari?q=Lagu");
    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: /^Tambahkan e2e Lagu .* ke playlist$/ }).nth(i).click();
      const d = page.getByRole("dialog", { name: "Tambahkan ke playlist" });
      await expect(d.getByRole("button", { name: /Teman perjalanan/ })).toBeVisible();
      if (await d.getByRole("button", { name: /Teman perjalanan/ }).isEnabled()) await d.getByRole("button", { name: /Teman perjalanan/ }).click();
      else await d.getByRole("button", { name: "Selesai" }).click();
      await expect(page.getByRole("dialog", { name: "Tambahkan ke playlist" })).toBeHidden();
    }
    await page.goto(playlistUrl);
    await expect(page.getByRole("heading", { level: 1, name: "Teman perjalanan" })).toBeVisible();
    await expect(page.getByText(/^2 lagu/)).toBeVisible();
    await waitHydrated(page);
    await page.getByRole("button", { name: "Putar playlist" }).click(); // pemutar tampil di dasar layar
    await waitForPlayback(page);
    await shot("fase3", "playlist");
    expect(await noHScroll(), "playlist: scroll horizontal").toBe(true);

    // ---------- Fase 4 ----------
    await page.goto("/unggah");
    await expect(page.getByRole("heading", { level: 1, name: "Unggah lagu" })).toBeVisible();
    await shot("fase4", "unggah-normal");
    expect(await noHScroll(), "unggah: scroll horizontal").toBe(true);

    await uploadOk(page, { title: "Senja di Stasiun", artist: "Pengunggah", album: "Demo", cover: true });
    await uploadOk(page, { title: "Hujan Pertama", artist: "Pengunggah" });
    await expect(slots(page)).toHaveText("2/3");
    await waitHydrated(page);
    await dismissToasts();
    await page.getByRole("button", { name: /^Putar (Hujan Pertama|Senja di Stasiun)$/ }).first().click(); // lagu pribadi lewat signed URL
    await waitForPlayback(page);
    await shot("fase4", "library");
    expect(await noHScroll(), "library: scroll horizontal").toBe(true);

    // kuota penuh (3/3)
    await uploadOk(page, { title: "Lagu Ketiga", artist: "Pengunggah" });
    await page.goto("/unggah");
    await expect(page.getByText("Slot penuh (3/3)")).toBeVisible();
    await page.getByText("Slot penuh (3/3)").scrollIntoViewIfNeeded();
    await shot("fase4", "unggah-kuota-penuh");
    expect(await noHScroll(), "unggah penuh: scroll horizontal").toBe(true);

    // bebaskan satu slot
    const freeOne = async (title: string) => {
      await page.goto("/library");
      await page.getByRole("button", { name: `Hapus ${title}` }).click();
      await page.getByRole("dialog", { name: "Hapus lagu ini?" }).getByRole("button", { name: "Hapus lagu" }).click();
      await expect(page.getByText(title, { exact: true })).toHaveCount(0);
    };
    await freeOne("Lagu Ketiga");

    // sedang mengunggah: berkas 8 MB, potongan kedua (PATCH) ditahan agar keadaan "Mengunggah NN%" terlihat
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route(/\/storage\/v1\/upload\/resumable/, async (route) => {
      if (route.request().method() === "PATCH") await gate;
      await route.continue();
    });
    await fillAndSubmit(page, { title: "Konser Panjang", artist: "Pengunggah", bytes: silentMp3(520) });
    await expect(page.getByRole("progressbar", { name: "Kemajuan unggahan" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Mengunggah… \d+%/)).toBeVisible({ timeout: 30_000 });
    await page.getByRole("progressbar", { name: "Kemajuan unggahan" }).scrollIntoViewIfNeeded();
    await shot("fase4", "unggah-sedang-mengunggah");
    release();
    await expect(page).toHaveURL((u) => u.pathname === "/library", { timeout: 60_000 });
    await page.unroute(/\/storage\/v1\/upload\/resumable/);
    await freeOne("Konser Panjang");

    // error: berkas .exe yang diganti nama menjadi .mp3
    const exe = new Uint8Array(40 * 1024).map((_, i) => (i * 31 + 7) & 0xff);
    exe.set([0x4d, 0x5a, 0x90, 0x00], 0);
    await fillAndSubmit(page, { name: "pemasang.mp3", bytes: exe, title: "Bukan Lagu", artist: "Pengunggah" });
    await expect(page.getByTestId("upload-error")).toHaveAttribute("data-code", "not_mp3", { timeout: 60_000 });
    await page.getByTestId("upload-error").scrollIntoViewIfNeeded();
    await shot("fase4", "unggah-error-mp3-palsu");
    expect(await noHScroll(), "unggah error: scroll horizontal").toBe(true);
  });
}

