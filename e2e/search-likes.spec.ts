import { expect, test } from "@playwright/test";
import { markPage, playerRegion, sampleAudio, signInAnonymously, waitForPlayback } from "./helpers";

// Fase 3 yang sudah jadi: pencarian dan suka. Data: seed contoh CI ("e2e Lagu N", "e2e Artis A/B", "e2e Album ...").

test("pencarian: ketik, hasil muncul, URL ?q bisa dibagikan, Back bekerja", async ({ page, browser }) => {
  await signInAnonymously(page);
  await page.getByRole("searchbox", { name: "Cari lagu, album, atau artis" }).fill("Lagu");
  await expect(page).toHaveURL(/\/cari\?q=Lagu$/, { timeout: 10_000 }); // debounce 300ms lalu navigasi
  await expect(page.getByRole("heading", { level: 1, name: "Hasil untuk “Lagu”" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Putar e2e Lagu/ }).first()).toBeVisible();

  // Back kembali ke halaman sebelumnya, Forward kembali ke hasil
  await page.goBack();
  await expect(page).toHaveURL((u) => u.pathname === "/");
  await page.goForward();
  await expect(page).toHaveURL(/\/cari\?q=Lagu$/);
  await expect(page.getByRole("heading", { level: 1, name: "Hasil untuk “Lagu”" })).toBeVisible();

  // URL yang dibagikan dibuka oleh pengunjung lain (konteks baru, masuk anonim sendiri) menampilkan hasil yang sama
  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await signInAnonymously(other);
  await other.goto(page.url());
  await expect(other.getByRole("heading", { level: 1, name: "Hasil untuk “Lagu”" })).toBeVisible();
  await expect(other.getByRole("button", { name: /^Putar e2e Lagu/ }).first()).toBeVisible();
  await ctx.close();
});

for (const q of ["%", "_", "100%", "a_b", "\\", "50% _ off"]) {
  test(`pencarian: query ${JSON.stringify(q)} diperlakukan literal, tidak error`, async ({ page }) => {
    await signInAnonymously(page);
    await page.goto(`/cari?q=${encodeURIComponent(q)}`);
    await expect(page.getByRole("heading", { level: 1, name: `Hasil untuk “${q}”` })).toBeVisible();
    // "%" dan "_" bukan wildcard: tidak ada lagu seed yang berisi karakter itu
    await expect(page.getByText(`Tidak ada hasil untuk “${q}”`)).toBeVisible();
  });
}

test("pencarian: tanpa hasil menampilkan keadaan kosong", async ({ page }) => {
  await signInAnonymously(page);
  await page.goto("/cari?q=zzzzqqqq");
  await expect(page.getByText("Tidak ada hasil untuk “zzzzqqqq”")).toBeVisible();
});

test("suka: hati di baris lagu, sinkron di player bar, muncul di /disukai, unlike tanpa menghentikan pemutaran", async ({ page }) => {
  await signInAnonymously(page);
  await page.goto("/cari?q=Lagu"); // beranda memakai kartu; baris lagu (dengan hati) ada di hasil pencarian/album/artis
  const row = page.getByRole("button", { name: /^Sukai e2e Lagu/ }).first();
  await expect(row).toBeVisible();
  const label = (await row.getAttribute("aria-label"))!; // "Sukai e2e Lagu N"
  const title = label.replace(/^Sukai /, "");

  // putar lagu itu dulu, supaya player bar menampilkan lagu yang sama
  await page.getByRole("button", { name: `Putar ${title}` }).first().click();
  await waitForPlayback(page);
  await markPage(page);
  const bar = playerRegion(page);

  await page.getByRole("button", { name: `Sukai ${title}` }).first().click();
  await expect(page.getByRole("button", { name: `Batal suka ${title}` }).first()).toHaveAttribute("aria-pressed", "true");
  // status sinkron di player bar (PlayerBar desktop; di ponsel tombol ada di pemutar penuh)
  await expect(bar.getByRole("button", { name: "Batal suka lagu ini" })).toHaveAttribute("aria-pressed", "true");

  // muncul di /disukai lewat navigasi sisi klien (audio tidak terputus)
  await page.getByRole("link", { name: "Disukai" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Lagu Disukai" })).toBeVisible();
  await expect(page.getByRole("button", { name: `Putar ${title}` }).or(page.getByRole("button", { name: `Jeda ${title}` })).first()).toBeVisible();

  // bertahan setelah muat ulang penuh (tersimpan di server, bukan hanya di store)
  await page.reload();
  await expect(page.getByRole("button", { name: `Batal suka ${title}` })).toBeVisible();

  // unlike: baris hilang dari daftar setelah muat ulang, pemutaran tidak berhenti
  await page.getByRole("button", { name: `Putar ${title}` }).first().click();
  await waitForPlayback(page);
  await markPage(page);
  const before = await sampleAudio(page);
  await page.getByRole("button", { name: `Batal suka ${title}` }).first().click();
  await expect(page.getByRole("button", { name: `Sukai ${title}` }).first()).toBeVisible();
  await page.waitForTimeout(1800);
  const after = await sampleAudio(page);
  expect(after.marker, "halaman dimuat ulang penuh").toBe("tetap");
  expect(after.paused, "pemutaran berhenti oleh unlike").toBe(false);
  expect(after.t).toBeGreaterThan(before.t + 1.0);

  await page.reload();
  await expect(page.getByText("Belum ada lagu yang disukai")).toBeVisible();
});
