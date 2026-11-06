import { expect, test, type Page } from "@playwright/test";
import { PNG_1X1, silentMp3 } from "../scripts/seed/make-sample.ts";
import { playerRegion, signInAnonymously, waitForPlayback } from "./helpers";

// Fase 4: unggah lagu pribadi (reserve -> TUS -> finalize), /library, hapus, kuota 3, penyimpanan penuh, reservasi
// kedaluwarsa, dan penolakan berkas palsu. Seluruh jalur memakai Supabase Storage sungguhan di CI.

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY!, authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json", prefer: "return=minimal", ...init.headers },
  });

type Opts = { name?: string; bytes?: Uint8Array; title: string; artist?: string; album?: string; cover?: boolean };

/** Mengisi dan mengirim formulir /unggah. Tidak menunggu hasil. */
async function fillAndSubmit(page: Page, o: Opts) {
  await page.goto("/unggah");
  await expect(page.getByRole("heading", { level: 1, name: "Unggah lagu" })).toBeVisible();
  await page.getByLabel(/^Berkas MP3/).setInputFiles({ name: o.name ?? "lagu.mp3", mimeType: "audio/mpeg", buffer: Buffer.from(o.bytes ?? silentMp3(30)) });
  await page.getByLabel("Judul", { exact: true }).fill(o.title);
  await page.getByLabel("Artis", { exact: true }).fill(o.artist ?? "Penguji");
  if (o.album) await page.getByLabel(/^Album/).fill(o.album);
  if (o.cover) await page.getByLabel(/^Sampul/).setInputFiles({ name: "sampul.png", mimeType: "image/png", buffer: Buffer.from(PNG_1X1) });
  await page.getByRole("button", { name: "Unggah", exact: true }).click();
}

async function uploadOk(page: Page, o: Opts) {
  await fillAndSubmit(page, o);
  await expect(page).toHaveURL((u) => u.pathname === "/library", { timeout: 60_000 });
  await expect(page.getByText(o.title, { exact: true }).first()).toBeVisible();
}

const slots = (page: Page) => page.getByTestId("slots");

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
  const rows = (await (await rest("songs?visibility=eq.private&title=eq.Rahasia%20A&select=id", { headers: { prefer: "" } })).json()) as { id: string }[];
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
