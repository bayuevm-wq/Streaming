import { expect, test } from "@playwright/test";
import { playerRegion, signInAnonymously, waitForPlayback, waitHydrated } from "./helpers";
import { fillAndSubmit, rest, silentMp3, slots, uploadOk } from "./upload-helpers";

// Fase 4: unggah lagu pribadi (reserve -> TUS -> finalize), /library, hapus, kuota 3, penyimpanan penuh, reservasi
// kedaluwarsa, dan penolakan berkas palsu. Seluruh jalur memakai Supabase Storage sungguhan di CI.


test("unggah MP3 + sampul: muncul di /library dengan slot 1/3 dan sisa waktu, bisa diputar (signed URL), lalu dihapus", async ({ page }) => {
  await signInAnonymously(page);
  await page.goto("/library");
  await expect(page.getByText("Library kamu masih kosong")).toBeVisible();
  await expect(slots(page)).toHaveText("0/3");

  await uploadOk(page, { title: "Lagu Pribadi Satu", artist: "Aku Sendiri", album: "Demo", cover: true });
  await expect(slots(page)).toHaveText("1/3");
  await expect(page.getByTestId("time-left").first()).toHaveText(/^(23 j \d+ m|24 j 0 m)$/); // 24 jam dikurangi beberapa detik

  // putar: signed URL dibuat saat diputar (atau dari cache pra-ambil), audio benar-benar berjalan
  await page.getByRole("button", { name: "Putar Lagu Pribadi Satu" }).click();
  await waitForPlayback(page);
  await expect(playerRegion(page)).toBeVisible();

  // hapus dengan konfirmasi: Batal tidak menghapus
  await page.getByRole("button", { name: "Hapus Lagu Pribadi Satu" }).click();
  const dialog = page.getByRole("dialog", { name: "Hapus lagu ini?" });
  await dialog.getByRole("button", { name: "Batal" }).click();
  await expect(page.getByText("Lagu Pribadi Satu", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Hapus Lagu Pribadi Satu" }).click();
  await dialog.getByRole("button", { name: "Hapus lagu" }).click();
  await expect(page.getByText("Library kamu masih kosong")).toBeVisible();
  await expect(slots(page)).toHaveText("0/3"); // slot dibebaskan
});

test("unggah 8 MB (dua potongan TUS 6 MB) berhasil", async ({ page }) => {
  test.setTimeout(120_000);
  await signInAnonymously(page);
  await uploadOk(page, { title: "Lagu Besar", bytes: silentMp3(520) }); // 520 dtk x 16000 B = ~8,3 MB
  await expect(slots(page)).toHaveText("1/3");
});

test("MP3 palsu (.exe diganti nama jadi .mp3) ditolak server, tanpa sisa data dan slot kembali bebas", async ({ page }) => {
  await signInAnonymously(page);
  const exe = new Uint8Array(40 * 1024).map((_, i) => (i * 31 + 7) & 0xff);
  exe.set([0x4d, 0x5a, 0x90, 0x00], 0); // "MZ": header Windows executable
  await fillAndSubmit(page, { name: "virus.mp3", bytes: exe, title: "Bukan Lagu" });
  const err = page.getByTestId("upload-error");
  await expect(err).toHaveAttribute("data-code", "not_mp3", { timeout: 60_000 });
  await expect(err).toContainText("bukan MP3 yang valid");

  await page.goto("/library");
  await expect(page.getByText("Library kamu masih kosong")).toBeVisible();
  await expect(slots(page)).toHaveText("0/3"); // reject_upload membebaskan slot
});

test("berkas > 10 MB ditolak di klien sebelum reservasi; ekstensi bukan .mp3 ditolak", async ({ page }) => {
  await signInAnonymously(page);
  await page.goto("/unggah");
  await waitHydrated(page);
  const input = page.getByLabel(/^Berkas MP3/);
  await input.setInputFiles({ name: "besar.mp3", mimeType: "audio/mpeg", buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 1) });
  await expect(page.getByText(/Berkas terlalu besar.*Maksimum 10 MB/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Unggah", exact: true })).toBeDisabled();

  await input.setInputFiles({ name: "lagu.wav", mimeType: "audio/wav", buffer: Buffer.from(silentMp3(10)) });
  await expect(page.getByText("Hanya file MP3 (.mp3) yang diterima.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Unggah", exact: true })).toBeDisabled();

  await page.goto("/library");
  await expect(slots(page)).toHaveText("0/3"); // tak ada reservasi yang dibuat
});

test("kuota 3 lagu: slot 3/3 menonaktifkan formulir dengan pesan jelas", async ({ page }) => {
  test.setTimeout(150_000);
  await signInAnonymously(page);
  for (const n of [1, 2, 3]) await uploadOk(page, { title: `Kuota ${n}`, bytes: silentMp3(20 + n) });
  await expect(slots(page)).toHaveText("3/3");
  await page.goto("/unggah");
  await expect(page.getByText("Slot penuh (3/3)")).toBeVisible();
  await expect(page.getByText(/Kamu sudah memakai 3 dari 3 slot/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Unggah", exact: true })).toBeDisabled();
  // hapus satu: slot bebas dan formulir aktif lagi
  await page.goto("/library");
  await page.getByRole("button", { name: "Hapus Kuota 1" }).click();
  await page.getByRole("dialog", { name: "Hapus lagu ini?" }).getByRole("button", { name: "Hapus lagu" }).click();
  await expect(slots(page)).toHaveText("2/3");
  await page.goto("/unggah");
  await expect(page.getByText("Slot penuh (3/3)")).toHaveCount(0);
});

test("reservasi kedaluwarsa (410): pesan jelas dan tidak ada data tersisa", async ({ page }) => {
  await signInAnonymously(page);
  // Setelah file terunggah, kedaluwarsakan reservasi di database tepat sebelum finalize berjalan.
  await page.route("**/api/uploads/*/finalize", async (route) => {
    const id = new URL(route.request().url()).pathname.split("/")[3];
    const r = await rest(`songs?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ expires_at: new Date(Date.now() - 60_000).toISOString() }) });
    expect(r.ok, `PATCH expires_at: ${r.status}`).toBe(true);
    await route.continue();
  });
  await fillAndSubmit(page, { title: "Terlambat" });
  const err = page.getByTestId("upload-error");
  await expect(err).toHaveAttribute("data-code", "reservation_expired", { timeout: 60_000 });
  await expect(err).toContainText("Waktu unggah habis");
  await page.goto("/library");
  await expect(page.getByText("Library kamu masih kosong")).toBeVisible();
  await expect(slots(page)).toHaveText("0/3");
});

test("isolasi: B tidak melihat lagu A, dan tidak bisa memfinalisasi atau menghapusnya", async ({ page, browser }) => {
  await signInAnonymously(page);
  await uploadOk(page, { title: "Rahasia A" });
  // id lagu A diambil lewat service role (hanya untuk uji)
  const rows = (await (await rest("songs?visibility=eq.private&title=eq.Rahasia%20A&select=id&order=created_at.desc&limit=1", { headers: { prefer: "" } })).json()) as { id: string }[];
  expect(rows.length).toBe(1);
  const songId = rows[0].id;

  const ctx = await browser.newContext();
  const b = await ctx.newPage();
  await signInAnonymously(b);
  await b.goto("/library");
  await expect(b.getByText("Library kamu masih kosong")).toBeVisible();
  await expect(b.getByText("Rahasia A")).toHaveCount(0);

  const fin = await b.evaluate((id) => fetch(`/api/uploads/${id}/finalize`, { method: "POST" }).then((r) => r.status), songId);
  expect(fin, "B memfinalisasi lagu A").toBe(404);
  const del = await b.evaluate((id) => fetch(`/api/songs/${id}`, { method: "DELETE" }).then((r) => r.status), songId);
  expect(del, "B menghapus lagu A").toBe(404);
  await ctx.close();

  await page.goto("/library");
  await expect(page.getByText("Rahasia A", { exact: true }).first()).toBeVisible(); // masih ada
});

test("CSRF: finalize dan hapus dari origin lain ditolak 403", async ({ page }) => {
  await signInAnonymously(page);
  const id = "00000000-0000-4000-8000-000000000000";
  const r = await page.request.post(`/api/uploads/${id}/finalize`, { headers: { origin: "https://evil.example" } });
  expect(r.status()).toBe(403);
  const d = await page.request.delete(`/api/songs/${id}`, { headers: { origin: "https://evil.example" } });
  expect(d.status()).toBe(403);
});

// TERAKHIR: mengubah batas global (app_limits) dan memulihkannya.
test("penyimpanan penuh: formulir ditutup dengan pesan yang jelas (penolakan di database: uji SQL T17)", async ({ page }) => {
  await signInAnonymously(page);
  const set = (cap: number) => rest("app_limits?id=eq.true", { method: "PATCH", body: JSON.stringify({ private_storage_cap_bytes: cap }) });
  try {
    expect((await set(1)).ok).toBe(true);
    await page.goto("/unggah");
    await expect(page.getByText("Upload ditutup sementara")).toBeVisible();
    await expect(page.getByText("Upload sedang ditutup sementara karena penyimpanan penuh. Coba lagi nanti.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Unggah", exact: true })).toBeDisabled();
  } finally {
    expect((await set(524288000)).ok).toBe(true);
  }
  await page.reload();
  await expect(page.getByText("Upload ditutup sementara")).toHaveCount(0);
});

test("lagu pribadi di playlist: setelah dihapus atau kedaluwarsa, playlist tidak error dan lagu hilang dari tampilan", async ({ page }) => {
  test.setTimeout(150_000);
  await signInAnonymously(page);
  await uploadOk(page, { title: "Playlist P1", bytes: silentMp3(20) });
  await uploadOk(page, { title: "Playlist P2", bytes: silentMp3(21) });

  // buat playlist dari dialog "Tambahkan ke playlist", lalu isi dengan kedua lagu pribadi
  await page.getByRole("button", { name: "Tambahkan Playlist P1 ke playlist" }).click();
  await page.getByRole("dialog", { name: "Tambahkan ke playlist" }).getByRole("button", { name: "Playlist baru" }).click();
  const create = page.getByRole("dialog", { name: "Playlist baru" });
  await create.getByLabel("Nama playlist").fill("Campur");
  await create.getByRole("button", { name: "Buat playlist" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Campur" })).toBeVisible();
  const playlistUrl = page.url();
  await page.goto("/library");
  for (const t of ["Playlist P1", "Playlist P2"]) {
    await page.getByRole("button", { name: `Tambahkan ${t} ke playlist` }).click();
    await page.getByRole("dialog", { name: "Tambahkan ke playlist" }).getByRole("button", { name: /Campur/ }).click();
    await expect(page.getByText(`“${t}” ditambahkan ke “Campur”.`)).toBeVisible();
  }
  await page.goto(playlistUrl);
  await expect(page.getByText(/^2 lagu/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Putar Playlist P1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Putar Playlist P2" })).toBeVisible();

  // lagu pribadi di playlist HARUS bisa diputar (jalur signed URL), bukan diperlakukan sebagai lagu publik
  await waitHydrated(page);
  await page.getByRole("button", { name: "Putar Playlist P1" }).click();
  await waitForPlayback(page);

  // begitu pula dari Lagu Disukai
  await page.goto("/library");
  await waitHydrated(page);
  await page.getByRole("button", { name: "Sukai Playlist P1" }).click();
  await expect(page.getByRole("button", { name: "Batal suka Playlist P1" })).toBeVisible();
  await page.goto("/disukai");
  await waitHydrated(page);
  await page.getByRole("button", { name: "Putar Playlist P1" }).click();
  await waitForPlayback(page);

  // 1) DIHAPUS pemiliknya: hilang dari playlist, tanpa error, hitungan ikut turun
  await page.goto("/library");
  await page.getByRole("button", { name: "Hapus Playlist P1" }).click();
  await page.getByRole("dialog", { name: "Hapus lagu ini?" }).getByRole("button", { name: "Hapus lagu" }).click();
  await expect(page.getByText("Playlist P1", { exact: true })).toHaveCount(0);
  await page.goto(playlistUrl);
  await expect(page.getByRole("heading", { level: 1, name: "Campur" })).toBeVisible();
  await expect(page.getByText(/^1 lagu/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Putar Playlist P1" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Putar Playlist P2" })).toBeVisible();

  // 2) KEDALUWARSA (jam database dimajukan lewat service role): hilang dari tampilan, playlist tetap terbuka tanpa error
  // terbaru dulu: percobaan ulang (retry) memakai database yang sama dan bisa meninggalkan lagu berjudul sama
  const rows = (await (await rest("songs?visibility=eq.private&title=eq.Playlist%20P2&select=id&order=created_at.desc&limit=1", { headers: { prefer: "" } })).json()) as { id: string }[];
  expect(rows.length).toBe(1);
  const r = await rest(`songs?id=eq.${rows[0].id}`, { method: "PATCH", body: JSON.stringify({ expires_at: new Date(Date.now() - 60_000).toISOString() }) });
  expect(r.ok, `PATCH expires_at: ${r.status}`).toBe(true);

  await page.goto(playlistUrl);
  await expect(page.getByRole("heading", { level: 1, name: "Campur" })).toBeVisible();
  await expect(page.getByText("Playlist ini masih kosong")).toBeVisible();
  await expect(page.getByRole("button", { name: "Putar Playlist P2" })).toHaveCount(0);
  await expect(page.getByText(/^0 lagu$/)).toBeVisible();

  // daftar playlist dan dialog "Tambahkan" juga tidak error; hitungan 0 lagu
  await page.goto("/playlist");
  await expect(page.getByRole("main").getByRole("link", { name: /Campur/ })).toContainText("0 lagu");
  await page.goto("/library");
  await expect(page.getByText("Library kamu masih kosong")).toBeVisible();
});
