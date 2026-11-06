import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAnonymously, waitForPlayback, waitHydrated } from "./helpers";
import { silentMp3, uploadOk } from "./upload-helpers";

// Audit aksesibilitas otomatis (axe-core: WCAG 2.0/2.1/2.2 A dan AA + praktik terbaik) pada halaman utama dan dialog,
// desktop dan ponsel. Semua pelanggaran dikumpulkan dulu lalu dilaporkan sekaligus; tes gagal bila ada pelanggaran.
// Catatan: axe hanya menangkap sebagian masalah (sekitar sepertiga); keyboard dan kontras ada di uji tersendiri
// (test:keyboard, test:contrast) dan pembaca layar tetap perlu diuji manual.

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

type Found = { where: string; id: string; impact: string | null | undefined; help: string; nodes: string[] };

async function scan(page: Page, where: string, found: Found[]) {
  const res = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  for (const v of res.violations) {
    found.push({ where, id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => `${n.target.join(" ")} :: ${(n.failureSummary ?? "").split("\n").slice(0, 2).join(" ")}`) });
  }
}

function report(found: Found[]) {
  const lines = found.map((f) => `[${f.impact}] ${f.id} @ ${f.where}: ${f.help}\n      ${f.nodes.join("\n      ")}`);
  return lines.join("\n");
}

for (const vp of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "ponsel", width: 390, height: 844 },
]) {
  test(`aksesibilitas (axe) pada ${vp.name}: halaman dan dialog`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const found: Found[] = [];
    const at = (s: string) => `${vp.name} ${s}`;

    // /masuk (sebelum login)
    await page.goto("/masuk");
    await expect(page.getByRole("button", { name: "Coba tanpa daftar" })).toBeVisible();
    await scan(page, at("/masuk"), found);

    await signInAnonymously(page);
    await page.getByRole("button", { name: /^Putar e2e Lagu/ }).first().click();
    await waitForPlayback(page);
    await scan(page, at("beranda (pemutar aktif)"), found);

    await page.getByRole("region", { name: "Album" }).getByRole("link").first().click();
    await page.waitForURL((u) => /^\/album\//.test(u.pathname));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await scan(page, at("album"), found);
    await page.locator("main header a[href^='/artis/']").first().click();
    await page.waitForURL((u) => /^\/artis\//.test(u.pathname));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await scan(page, at("artis"), found);

    await page.goto("/cari?q=Lagu");
    await expect(page.getByRole("button", { name: /^Sukai e2e Lagu/ }).first()).toBeVisible();
    await waitHydrated(page);
    await scan(page, at("pencarian"), found);

    await page.goto("/cari?q=zzzzqq");
    await expect(page.getByText("Tidak ada hasil untuk “zzzzqq”")).toBeVisible();
    await scan(page, at("pencarian kosong"), found);

    // dialog "Tambahkan ke playlist" lalu "Playlist baru"
    await page.goto("/cari?q=Lagu");
    await waitHydrated(page);
    await page.getByRole("button", { name: /^Tambahkan e2e Lagu .* ke playlist$/ }).first().click();
    await expect(page.getByRole("dialog", { name: "Tambahkan ke playlist" })).toBeVisible();
    await scan(page, at("dialog Tambahkan ke playlist"), found);
    await page.getByRole("dialog", { name: "Tambahkan ke playlist" }).getByRole("button", { name: "Playlist baru" }).click();
    const create = page.getByRole("dialog", { name: "Playlist baru" });
    await expect(create).toBeVisible();
    await create.getByLabel("Nama playlist").fill("   ");
    await create.getByRole("button", { name: "Buat playlist" }).click();
    await expect(create.getByText("Nama playlist tidak boleh kosong.")).toBeVisible();
    await scan(page, at("dialog Playlist baru dengan galat"), found);
    await create.getByLabel("Nama playlist").fill("Audit");
    await create.getByRole("button", { name: "Buat playlist" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Audit" })).toBeVisible();
    await scan(page, at("playlist kosong"), found);

    await page.goto("/playlist");
    await expect(page.getByRole("main").getByRole("link", { name: /Audit/ })).toBeVisible();
    await scan(page, at("daftar playlist"), found);

    await page.goto("/disukai");
    await expect(page.getByRole("heading", { level: 1, name: "Lagu Disukai" })).toBeVisible();
    await scan(page, at("Lagu Disukai kosong"), found);

    await page.goto("/library");
    await expect(page.getByText("Library kamu masih kosong")).toBeVisible();
    await scan(page, at("library kosong"), found);

    await uploadOk(page, { title: "Audit Lagu", bytes: silentMp3(25) });
    await waitHydrated(page);
    await scan(page, at("library berisi"), found);
    await page.getByRole("button", { name: "Hapus Audit Lagu" }).click();
    await expect(page.getByRole("dialog", { name: "Hapus lagu ini?" })).toBeVisible();
    await scan(page, at("dialog hapus lagu"), found);
    await page.getByRole("dialog", { name: "Hapus lagu ini?" }).getByRole("button", { name: "Batal" }).click();

    await page.goto("/unggah");
    await expect(page.getByRole("heading", { level: 1, name: "Unggah lagu" })).toBeVisible();
    await scan(page, at("unggah"), found);

    // pemutar: antrean dan (ponsel) pemutar penuh
    await page.goto("/");
    await waitHydrated(page);
    await page.getByRole("button", { name: /^Putar e2e Lagu/ }).first().click();
    await waitForPlayback(page);
    if (vp.width <= 760) {
      await page.getByRole("region", { name: "Pemutar musik" }).getByRole("button", { name: /^Buka pemutar/ }).click();
      await expect(page.getByRole("dialog", { name: "Pemutar" })).toBeVisible();
      await scan(page, at("pemutar penuh"), found);
      await page.getByRole("dialog", { name: "Pemutar" }).getByRole("button", { name: "Antrean" }).click();
    } else {
      await page.getByRole("region", { name: "Pemutar musik" }).getByRole("button", { name: "Buka antrean" }).click();
    }
    await expect(page.getByRole("dialog", { name: "Antrean" })).toBeVisible();
    await scan(page, at("antrean"), found);

    console.log(`A11Y ${vp.name}: ${found.length} pelanggaran\n${report(found)}`);
    expect(found.length, `Pelanggaran aksesibilitas:\n${report(found)}`).toBe(0);
  });
}
