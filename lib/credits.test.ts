import assert from "node:assert/strict";
import { countByLicense, groupCredits, licenseDeed, safeHref, type CreditItem } from "./credits.ts";

const t = (name: string, fn: () => void) => (fn(), console.log(`PASS ${name}`));
const item = (id: string, title: string, artist: string, album: string | null, license: string): CreditItem => ({ id, title, artist, album, license, sourceUrl: `https://x.example/${id}`, credit: `"${title}" ${artist}` });

t("deed: tiga lisensi dikenal, lainnya null (tidak menebak tautan)", () => {
  assert.equal(licenseDeed("CC0 1.0")?.url, "https://creativecommons.org/publicdomain/zero/1.0/");
  assert.equal(licenseDeed("CC BY 4.0")?.url, "https://creativecommons.org/licenses/by/4.0/");
  assert.equal(licenseDeed("CC BY-SA 4.0")?.url, "https://creativecommons.org/licenses/by-sa/4.0/");
  assert.equal(licenseDeed("CC BY-NC 4.0"), null);
  assert.equal(licenseDeed("MIT"), null);
});
t("safeHref: hanya http(s)", () => {
  assert.equal(safeHref("https://freemusicarchive.org/music/a/"), "https://freemusicarchive.org/music/a/");
  assert.equal(safeHref("http://creativecommons.org/licenses/by/4.0/"), "http://creativecommons.org/licenses/by/4.0/");
  assert.equal(safeHref("javascript:alert(1)"), null);
  assert.equal(safeHref("data:text/html,x"), null);
  assert.equal(safeHref("bukan url"), null);
});
t("groupCredits: per album+artis, urutan kemunculan dipertahankan, tanpa album = Single", () => {
  const g = groupCredits([item("1", "A", "X", "Alb1", "CC0 1.0"), item("2", "B", "Y", "Alb2", "CC BY 4.0"), item("3", "C", "X", "Alb1", "CC0 1.0"), item("4", "D", "Z", null, "CC0 1.0")]);
  assert.deepEqual(g.map((x) => [x.artist, x.album, x.items.map((i) => i.id)]), [["X", "Alb1", ["1", "3"]], ["Y", "Alb2", ["2"]], ["Z", "Single", ["4"]]]);
});
t("groupCredits: album bernama sama pada artis berbeda tidak digabung", () => {
  const g = groupCredits([item("1", "A", "X", "Greatest", "CC0 1.0"), item("2", "B", "Y", "Greatest", "CC0 1.0")]);
  assert.equal(g.length, 2);
});
t("countByLicense: urut CC0, BY, BY-SA", () => {
  const c = countByLicense([item("1", "A", "X", null, "CC BY-SA 4.0"), item("2", "B", "X", null, "CC0 1.0"), item("3", "C", "X", null, "CC BY 4.0"), item("4", "D", "X", null, "CC0 1.0")]);
  assert.deepEqual(c, [["CC0 1.0", 2], ["CC BY 4.0", 1], ["CC BY-SA 4.0", 1]]);
});
console.log("SEMUA LULUS");
