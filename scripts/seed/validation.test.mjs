// validation.test.mjs: uji offline untuk aturan katalog (F9/F19). Tanpa jaringan, tanpa Supabase.
//   node scripts/seed/validation.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PNG_1X1, silentMp3, writeSample } from "./make-sample.ts";

const run = (args, env = {}) =>
  spawnSync(process.execPath, ["scripts/seed.ts", ...args], { encoding: "utf8", env: { ...process.env, ...env } });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "seed-test-"));
const pass = (n) => console.log(`PASS ${n}`);

/** Sampel valid yang boleh dimodifikasi; mengembalikan {dir, file, catalog, save()}. */
function sample() {
  const dir = tmp();
  const file = writeSample(dir, "t");
  const catalog = JSON.parse(fs.readFileSync(file, "utf8"));
  return { dir, file, catalog, save: () => fs.writeFileSync(file, JSON.stringify(catalog)) };
}
function expectFail(name, mutate, expected, extraArgs = ["--relaxed"]) {
  const s = sample();
  mutate(s);
  s.save();
  const r = run(["--dry-run", "--catalog", s.file, ...extraArgs]);
  assert.notEqual(r.status, 0, `${name}: seharusnya gagal\n${r.stdout}`);
  assert.match(r.stderr, expected, `${name}: pesan tidak sesuai\n${r.stderr}`);
  pass(name);
}

// --- positif ---------------------------------------------------------------------------------------
{
  const s = sample();
  const r = run(["--dry-run", "--relaxed", "--catalog", s.file]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /3 lagu, 2 album, 2 artis lolos validasi/);
  assert.doesNotMatch(r.stderr, /PERINGATAN/); // sampel 128 kbps: tidak ada peringatan bitrate
  pass("katalog contoh valid lolos (mode relaxed)");
}
for (const license of ["CC0 1.0", "CC BY 4.0", "CC BY-SA 4.0", "cc by-sa 4.0", "CC-BY-4.0"]) {
  const s = sample();
  s.catalog.songs[0].license = license;
  s.save();
  const r = run(["--dry-run", "--relaxed", "--catalog", s.file]);
  assert.equal(r.status, 0, `${license}: ${r.stderr}`);
  pass(`lisensi ${license} diterima`);
}
{
  // 12,8 MB: di atas batas pengunjung (10 MiB) tetapi di bawah batas katalog (15 MiB).
  const s = sample();
  fs.writeFileSync(path.join(s.dir, "audio", "t-1.mp3"), silentMp3(800));
  const r = run(["--dry-run", "--relaxed", "--catalog", s.file]);
  assert.equal(r.status, 0, r.stderr);
  pass("MP3 12,8 MB diterima untuk katalog (batas 15 MiB, bukan 10 MiB pengunjung)");
}

// --- negatif: format, ukuran, isi ------------------------------------------------------------------
expectFail("OGG ditolak (Safari tidak konsisten)", (s) => {
  fs.copyFileSync(path.join(s.dir, "audio", "t-1.mp3"), path.join(s.dir, "audio", "x.ogg"));
  s.catalog.songs[0].file = "audio/x.ogg";
}, /OGG tidak didukung/);
expectFail("WAV ditolak", (s) => {
  fs.copyFileSync(path.join(s.dir, "audio", "t-1.mp3"), path.join(s.dir, "audio", "x.wav"));
  s.catalog.songs[0].file = "audio/x.wav";
}, /tidak didukung/);
expectFail("MP3 di atas 15 MiB ditolak", (s) => {
  fs.writeFileSync(path.join(s.dir, "audio", "t-1.mp3"), silentMp3(1100)); // ~17,6 MB
}, /melebihi batas 15 MiB/);
expectFail("file berekstensi .mp3 tetapi isinya WAV ditolak", (s) => {
  const wav = new Uint8Array(100_000);
  wav.set([0x52, 0x49, 0x46, 0x46]);
  wav.set([0x57, 0x41, 0x56, 0x45], 8);
  fs.writeFileSync(path.join(s.dir, "audio", "t-1.mp3"), wav);
}, /bukan MP3 yang valid/);
expectFail("M4A palsu (tanpa kotak ftyp) ditolak", (s) => {
  fs.writeFileSync(path.join(s.dir, "audio", "x.m4a"), new Uint8Array(10_000));
  s.catalog.songs[0].file = "audio/x.m4a";
}, /bukan M4A/);
expectFail("cover dengan isi bukan gambar ditolak", (s) => {
  fs.writeFileSync(path.join(s.dir, "covers", "cover.png"), new Uint8Array(100));
}, /bukan PNG yang valid/);
expectFail("cover di atas 2 MiB ditolak", (s) => {
  fs.writeFileSync(path.join(s.dir, "covers", "cover.png"), Buffer.concat([PNG_1X1, Buffer.alloc(2.5 * 1048576)]));
}, /melebihi batas 2 MiB/);

// --- negatif: lisensi dan sumber -------------------------------------------------------------------
expectFail("lisensi NC ditolak", (s) => { s.catalog.songs[0].license = "CC BY-NC 4.0"; }, /non-komersial/);
expectFail("lisensi NC lain (NC-SA) ditolak", (s) => { s.catalog.songs[0].license = "CC-BY-NC-SA"; }, /non-komersial/);
expectFail("lisensi di luar tiga yang diizinkan ditolak (MIT)", (s) => { s.catalog.songs[0].license = "MIT"; }, /hanya CC0 1.0, CC BY 4.0, CC BY-SA 4.0/);
expectFail("Pixabay Content License ditolak (melarang distribusi standalone)", (s) => { s.catalog.songs[0].license = "Pixabay Content License"; }, /tidak diizinkan/);
expectFail("lisensi ND ditolak", (s) => { s.catalog.songs[0].license = "CC BY-ND 4.0"; }, /tanpa-turunan/);
expectFail("lisensi FMA-Limited ditolak", (s) => { s.catalog.songs[0].license = "FMA-Limited"; }, /FMA-Limited/);
expectFail("versi CC lama (CC BY 3.0) ditolak", (s) => { s.catalog.songs[0].license = "CC BY 3.0"; }, /tidak diizinkan/);
expectFail("CC BY-SA 3.0 ditolak", (s) => { s.catalog.songs[0].license = "CC BY-SA 3.0"; }, /tidak diizinkan/);
expectFail("lisensi tak jelas ditolak", (s) => { s.catalog.songs[0].license = "bebas dipakai"; }, /tidak diizinkan/);
expectFail("source wajib", (s) => { delete s.catalog.songs[0].source; }, /source wajib/);
expectFail("license wajib", (s) => { delete s.catalog.songs[0].license; }, /license wajib/);

// --- negatif: bentuk katalog -----------------------------------------------------------------------
expectFail("key lagu duplikat", (s) => { s.catalog.songs[1].key = s.catalog.songs[0].key; }, /duplikat/);
expectFail("artis tidak terdaftar", (s) => { s.catalog.songs[0].artist = "Tak Dikenal"; }, /tidak ada di daftar artis/);
expectFail("album tidak ada untuk artis itu", (s) => { s.catalog.songs[0].album = "Album Hantu"; }, /tidak ada untuk artis itu/);
expectFail("jalur keluar dari folder katalog (path traversal)", (s) => { s.catalog.songs[0].file = "../luar.mp3"; }, /keluar dari folder katalog/);
expectFail("mode ketat menolak katalog kecil (jumlah minimum)", () => {}, /minimal 15/, []);
expectFail("mode ketat meminta cover", (s) => { delete s.catalog.albums[0].cover; }, /cover wajib/, []);

// --- target non-lokal tanpa --yes ------------------------------------------------------------------
{
  const s = sample();
  const r = run(["--relaxed", "--catalog", s.file], {
    SUPABASE_URL: "https://contoh.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "x",
  });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /bukan lokal.*--yes/);
  pass("target non-lokal ditolak tanpa --yes (tanpa menyentuh jaringan)");
}
// --- README: tabel sumber/lisensi hanya mengganti isi di antara penanda ----------------------------
{
  const s = sample();
  const cwd = tmp();
  fs.writeFileSync(path.join(cwd, "README.md"), "# Judul\n\nsebelum\n<!-- seed-sources:start -->\nlama\n<!-- seed-sources:end -->\nsesudah\n");
  const r = spawnSync(process.execPath, [path.resolve("scripts/seed.ts"), "--dry-run", "--relaxed", "--readme", "--catalog", s.file], { encoding: "utf8", cwd });
  assert.equal(r.status, 0, r.stderr);
  const out = fs.readFileSync(path.join(cwd, "README.md"), "utf8");
  assert.match(out, /^# Judul\n\nsebelum\n<!-- seed-sources:start -->\n\| Lagu \| Artis \| Sumber \| Lisensi \|/);
  assert.match(out, /\| t Lagu 1 \| t Artis A \| berkas uji sintetis \(bukan musik\) \| CC0 1\.0 \|/);
  assert.match(out, /<!-- seed-sources:end -->\nsesudah\n$/);
  assert.doesNotMatch(out, /lama/);
  pass("--readme menulis tabel sumber/lisensi hanya di antara penanda");
}
console.log("SEMUA LULUS");
