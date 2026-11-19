// Audio PENGGANTI untuk pratinjau tangkapan layar di CI (workflow screenshots-katalog): MP3 sunyi sintetis dengan durasi
// SAMA seperti lagu asli (dari scripts/seed/preview-durations.json, hasil prepare-audio). Audio asli tidak ada di repo
// dan tidak boleh masuk git; tangkapan layar hanya menampilkan metadata, kredit, sampul, dan durasi, bukan bunyinya.
//
//   node scripts/seed/make-preview-audio.ts
import fs from "node:fs";
import { silentMp3 } from "./make-sample.ts";

const catalog = JSON.parse(fs.readFileSync("scripts/seed/catalog.json", "utf8")) as { songs: { key: string; file: string }[] };
const durations = JSON.parse(fs.readFileSync("scripts/seed/preview-durations.json", "utf8")) as Record<string, number>;
fs.mkdirSync("scripts/seed/audio", { recursive: true });
// PENGAMAN: skrip ini hanya untuk CI (checkout bersih). Di mesin yang sudah punya audio asli di scripts/seed/audio/ ia menolak
// menimpanya, kecuali dipaksa dengan --force.
const existing = catalog.songs.filter((s) => fs.existsSync(`scripts/seed/${s.file}`));
if (existing.length > 0 && !process.argv.includes("--force")) {
  console.error(`MENOLAK: ${existing.length} berkas audio sudah ada di scripts/seed/audio/ (mungkin audio asli). Gunakan --force bila memang ingin menimpanya.`);
  process.exit(1);
}
for (const s of catalog.songs) {
  const d = durations[s.key];
  if (!d) throw new Error(`durasi untuk "${s.key}" tidak ada di preview-durations.json (jalankan prepare-audio)`);
  fs.writeFileSync(`scripts/seed/${s.file}`, silentMp3(d));
}
console.log(`${catalog.songs.length} berkas audio pengganti (sunyi) dibuat di scripts/seed/audio/`);
