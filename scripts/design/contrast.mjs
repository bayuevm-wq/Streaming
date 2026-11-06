// Memeriksa kontras WCAG 2.x pada token warna di app/globals.css. Gagal (kode 1) bila ada pasangan di bawah minimum
// atau bila warna status terlalu dekat dengan aksen kobalt.
//   node scripts/design/contrast.mjs              # ringkasan teks
//   node scripts/design/contrast.mjs --markdown   # tabel markdown (untuk docs/design-system.md)
import fs from "node:fs";
import { contrastRatio, formatRatio, hueGap, parseColorTokens } from "../../lib/design/contrast.ts";

const css = fs.readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const tokens = parseColorTokens(css);
const t = (k) => {
  if (!tokens[k]) throw new Error(`token --color-${k} tidak ditemukan di app/globals.css`);
  return tokens[k];
};

const text = 4.5;
const ui = 3;
// [peran, depan, latar, minimum]
const pairs = [
  ["Teks utama", "ink", "ground", text], ["Teks utama", "ink", "surface", text], ["Teks utama", "ink", "raised", text],
  ["Teks redup", "muted", "ground", text], ["Teks redup", "muted", "surface", text], ["Teks redup", "muted", "raised", text],
  ["Aksen sebagai teks (lagu aktif)", "accent", "ground", text], ["Aksen sebagai teks (lagu aktif)", "accent", "surface", text], ["Aksen sebagai teks (lagu aktif)", "accent", "raised", text],
  ["Teks pada tombol utama", "on-accent", "accent", text], ["Teks pada tombol utama (hover)", "on-accent", "accent-hover", text],
  ["Teks pesan status", "ink", "success-surface", text], ["Teks pesan status", "ink", "warning-surface", text], ["Teks pesan status", "ink", "error-surface", text],
  ["Judul status berwarna", "success", "success-surface", text], ["Judul status berwarna", "warning", "warning-surface", text], ["Judul status berwarna", "error", "error-surface", text],
  ["Ikon status", "success", "ground", ui], ["Ikon status", "warning", "ground", ui], ["Ikon status", "error", "ground", ui],
  ["Batas kontrol (input, slider)", "control", "ground", ui], ["Batas kontrol (input, slider)", "control", "surface", ui], ["Batas kontrol (input, slider)", "control", "raised", ui],
  ["Cincin fokus dan isi slider", "accent", "ground", ui], ["Cincin fokus dan isi slider", "accent", "surface", ui], ["Cincin fokus dan isi slider", "accent", "raised", ui],
  ["Cincin fokus pada pesan status", "accent", "success-surface", ui], ["Cincin fokus pada pesan status", "accent", "warning-surface", ui], ["Cincin fokus pada pesan status", "accent", "error-surface", ui],
];

const rows = pairs.map(([role, fg, bg, min]) => {
  const r = contrastRatio(t(fg), t(bg));
  return { role, fg, bg, min, r, ok: r >= min };
});
const hueRows = ["success", "warning", "error"].map((k) => {
  const gap = hueGap(t(k), t("accent"));
  return { k, gap, ok: gap >= 60 };
});
const failed = rows.filter((x) => !x.ok).length + hueRows.filter((x) => !x.ok).length;

if (process.argv.includes("--markdown")) {
  console.log("| Peran | Depan | Latar | Rasio | Minimum | Hasil |\n|---|---|---|---|---|---|");
  for (const x of rows) {
    console.log(`| ${x.role} | \`${x.fg}\` ${t(x.fg).toUpperCase()} | \`${x.bg}\` ${t(x.bg).toUpperCase()} | **${formatRatio(x.r)}:1** | ${x.min}:1 | ${x.ok ? "lulus" : "GAGAL"} |`);
  }
  console.log("\n| Warna status | Selisih rona dengan aksen kobalt | Minimum | Hasil |\n|---|---|---|---|");
  for (const h of hueRows) console.log(`| \`${h.k}\` ${t(h.k).toUpperCase()} | ${h.gap.toFixed(0)}° | 60° | ${h.ok ? "lulus" : "GAGAL"} |`);
} else {
  for (const x of rows) console.log(`${x.ok ? "OK   " : "GAGAL"} ${formatRatio(x.r).padStart(6)}:1 (min ${x.min})  ${x.fg} / ${x.bg}  [${x.role}]`);
  for (const h of hueRows) console.log(`${h.ok ? "OK   " : "GAGAL"} selisih rona ${h.gap.toFixed(0)}° (min 60°)  ${h.k} vs accent`);
  console.log(failed === 0 ? `\nSEMUA LULUS (${rows.length} pasangan kontras + ${hueRows.length} cek rona)` : `\n${failed} PEMERIKSAAN GAGAL`);
}
process.exit(failed === 0 ? 0 : 1);
