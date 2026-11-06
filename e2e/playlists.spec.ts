import { expect, test, type Page } from "@playwright/test";
import { signInAnonymously } from "./helpers";

// Playlist (F8): buat, ganti nama, hapus (konfirmasi), tambah/hapus lagu, "Sudah ada di playlist", batas 20,
// isolasi antar pengunjung. Batas 200 lagu tidak diuji di sini (seed CI hanya 3 lagu): ditegakkan trigger dan diuji di
// SQL (db-tests), pesannya diuji unit (lib/playlists/rules.test.ts).

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Playlist" });

async function createPlaylist(page: Page, name: string) {
  await page.getByRole("button", { name: "Buat playlist" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Playlist baru" });
  await dialog.getByLabel("Nama playlist").fill(name);
  await dialog.getByRole("button", { name: "Buat playlist" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

test("playlist: buat, tambah lagu, 'Sudah ada', hapus lagu, ganti nama, hapus dengan konfirmasi", async ({ page }) => {
  await signInAnonymously(page);
  await expect(sidebar(page).getByText("Belum ada playlist.")).toBeVisible();

  await createPlaylist(page, "Santai");
  await expect(sidebar(page).getByRole("link", { name: "Santai" })).toBeVisible();
  await expect(page.getByText("Playlist ini masih kosong")).toBeVisible();

  // tambah lagu dari hasil pencarian lewat "+"
  await page.goto("/cari?q=Lagu");
  const add = page.getByRole("button", { name: /^Tambahkan e2e Lagu .* ke playlist$/ }).first();
  const addLabel = (await add.getAttribute("aria-label"))!;
  const title = addLabel.replace(/^Tambahkan /, "").replace(/ ke playlist$/, "");
  await add.click();
  const addDialog = page.getByRole("dialog", { name: "Tambahkan ke playlist" });
  await addDialog.getByRole("button", { name: /Santai/ }).click();
  await expect(page.getByText(`“${title}” ditambahkan ke “Santai”.`)).toBeVisible();

  // lagu yang sama lagi: tombol playlist itu nonaktif dengan keterangan "Sudah ada di playlist"
  await page.getByRole("button", { name: addLabel }).first().click();
  const again = addDialog.getByRole("button", { name: /Santai/ });
  await expect(again).toContainText("Sudah ada di playlist");
  await expect(again).toBeDisabled();
  await addDialog.getByRole("button", { name: "Selesai" }).click();

  // halaman playlist menampilkan lagu itu; durasi total memakai format baru
  await sidebar(page).getByRole("link", { name: "Santai" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Santai" })).toBeVisible();
  await expect(page.getByRole("button", { name: `Putar ${title}` })).toBeVisible();
  await expect(page.getByText(/^1 lagu · 1 mnt \d+ dtk$/)).toBeVisible();

  // hapus lagu dari playlist
  await page.getByRole("button", { name: `Hapus ${title} dari playlist` }).click();
  await expect(page.getByText("Playlist ini masih kosong")).toBeVisible();

  // ganti nama
  await page.getByRole("button", { name: "Ganti nama" }).click();
  const rename = page.getByRole("dialog", { name: "Ganti nama playlist" });
  await rename.getByLabel("Nama playlist").fill("Santai Sore");
  await rename.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Santai Sore" })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Santai Sore" })).toBeVisible();

  // hapus: Batal tidak menghapus, konfirmasi menghapus
  await page.getByRole("button", { name: "Hapus playlist" }).click();
  const del = page.getByRole("dialog", { name: "Hapus playlist?" });
  await expect(del).toContainText("Santai Sore");
  await del.getByRole("button", { name: "Batal" }).click();
  await expect(del).toBeHidden();
  await expect(sidebar(page).getByRole("link", { name: "Santai Sore" })).toBeVisible();

  await page.getByRole("button", { name: "Hapus playlist" }).click();
  await del.getByRole("button", { name: "Hapus playlist" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Playlist" })).toBeVisible();
  await expect(sidebar(page).getByText("Belum ada playlist.")).toBeVisible();
});

test("playlist: nama kosong ditolak dengan pesan, bukan galat", async ({ page }) => {
  await signInAnonymously(page);
  await page.getByRole("button", { name: "Buat playlist" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Playlist baru" });
  await dialog.getByLabel("Nama playlist").fill("   ");
  await dialog.getByRole("button", { name: "Buat playlist" }).click();
  await expect(dialog.getByText("Nama playlist tidak boleh kosong.")).toBeVisible();
});

test("playlist: batas 20 playlist dengan pesan yang jelas", async ({ page }) => {
  test.setTimeout(180_000);
  await signInAnonymously(page);
  for (let i = 1; i <= 20; i++) await createPlaylist(page, `P${i}`);
  await page.goto("/playlist");
  await expect(page.getByText("20 dari 20 playlist")).toBeVisible();
  // tombol di halaman nonaktif; lewat sidebar dialog menjelaskan batasnya
  await expect(page.getByRole("main").getByRole("button", { name: "Buat playlist" })).toBeDisabled();
  await sidebar(page).getByRole("button", { name: "Buat playlist" }).click();
  const dialog = page.getByRole("dialog", { name: "Playlist baru" });
  await expect(dialog.getByText("Batas 20 playlist tercapai. Hapus satu playlist untuk membuat yang baru.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Buat playlist" })).toBeDisabled();
});

test("isolasi: playlist A tidak terlihat oleh B, dan URL-nya 404 bagi B", async ({ page, browser }) => {
  await signInAnonymously(page);
  await createPlaylist(page, "Rahasia A");
  const urlA = page.url();
  expect(urlA).toMatch(/\/playlist\/[0-9a-f-]{36}$/);

  const ctx = await browser.newContext();
  const b = await ctx.newPage();
  await signInAnonymously(b);
  await b.goto("/playlist");
  await expect(b.getByRole("heading", { level: 1, name: "Playlist" })).toBeVisible();
  await expect(b.getByText("Belum ada playlist").first()).toBeVisible();
  await expect(b.getByText("Rahasia A")).toHaveCount(0);
  await expect(sidebar(b).getByText("Rahasia A")).toHaveCount(0);

  await b.goto(urlA);
  await expect(b.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
  await expect(b.getByText("Rahasia A")).toHaveCount(0);
  await ctx.close();

  // A tetap melihat miliknya
  await page.goto(urlA);
  await expect(page.getByRole("heading", { level: 1, name: "Rahasia A" })).toBeVisible();
});

test("ponsel: Playlist ada di navigasi bawah dan bisa dipakai", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAnonymously(page);
  const nav = page.getByRole("navigation", { name: "Utama" });
  await nav.getByRole("link", { name: "Playlist" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Playlist" })).toBeVisible();
  await page.getByRole("button", { name: "Buat playlist" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Playlist baru" });
  await dialog.getByLabel("Nama playlist").fill("Di ponsel");
  await dialog.getByRole("button", { name: "Buat playlist" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Di ponsel" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Playlist" })).toHaveAttribute("aria-current", "page"); // juga di /playlist/[id]
});
