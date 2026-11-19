// Menyiapkan audio seed dari folder LOKAL (di luar repo) ke scripts/seed/audio/ (tidak masuk git).
//
//   node scripts/seed/prepare-audio.mjs --src "E:\musik-seed"
//
// Untuk tiap lagu di catalog.json: salin dari folder sumber; bila bitrate di atas 192 kbps, ubah ke MP3 192 kbps dengan
// ffmpeg-static (metadata ID3 dan gambar sampul tertanam dibuang: sampul dibuat sendiri, bukan dari situs sumber).
// Lalu periksa dengan validator MP3 yang sama dengan seed (maks 15 MiB, 3 frame Layer III beruntun) dan tulis durasi
// ke scripts/seed/preview-durations.json (dipakai pratinjau tangkapan layar di CI; durasi bukan konten berhak cipta).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { parseFile } from "music-metadata";
import { checkMp3, LIMITS } from "../../lib/audio/mp3.ts";
import { CATALOG_MAX_BYTES, RECOMMENDED_KBPS } from "./rules.ts";

/** key lagu di catalog.json -> [folder sumber, nama berkas] di dalam --src. */
const SOURCES = {
  "holizna-2-hour-delay": ["HoliznaCC0 - Winter Lofi", "01 HoliznaCC0 - 2 Hour Delay.mp3"],
  "holizna-winter-blues": ["HoliznaCC0 - Winter Lofi", "02 HoliznaCC0 - Winter Blues.mp3"],
  "holizna-first-snow": ["HoliznaCC0 - Winter Lofi", "03 HoliznaCC0 - First Snow.mp3.mp3"],
  "holizna-snow-drift": ["HoliznaCC0 - Winter Lofi", "04 HoliznaCC0 - Snow Drift.mp3"],
  "holizna-fire-place": ["HoliznaCC0 - Winter Lofi", "05 HoliznaCC0 - Fire Place.mp3"],
  "komiku-we-need-a-plan": ["Komiku - ULTRA PERSON VOL4", "02 Komiku - We need a plan.mp3"],
  "komiku-the-night-before-the-fight-of-our-life": ["Komiku - ULTRA PERSON VOL4", "04 Komiku - The night before the fight of our life.mp3"],
  "komiku-the-evil-plan": ["Komiku - ULTRA PERSON VOL4", "06 Komiku - The Evil Plan.mp3"],
  "komiku-the-end": ["Komiku - ULTRA PERSON VOL4", "08 Komiku - The end.mp3"],
  "lobo-loco-powerful-day": ["Lobo Loco - FREE FOR YOU - CC BY", "03 Lobo Loco - Powerful Day (ID 2337).mp3"],
  "lobo-loco-beach-and-surf": ["Lobo Loco - FREE FOR YOU - CC BY", "11 Lobo Loco - Beach and Surf (ID 2361).mp3"],
  "lobo-loco-little-clouds": ["Lobo Loco - FREE FOR YOU - CC BY", "15 Lobo Loco - Little Clouds (ID 2367).mp3"],
  "lobo-loco-roadtrip-to-kansas": ["Lobo Loco - FREE FOR YOU - CC BY", "20 Lobo Loco - Roadtrip to Kansas (ID 2370).mp3"],
  "kevin-macleod-carefree": ["Kevin MacLeod", "Carefree.mp3"],
  "kevin-macleod-local-forecast-elevator": ["Kevin MacLeod", "Local Forecast - Elevator.mp3"],
  "kevin-macleod-wallpaper": ["Kevin MacLeod", "Wallpaper.mp3"],
  "kevin-macleod-sneaky-snitch": ["Kevin MacLeod", "Sneaky Snitch.mp3"],
};

const argv = process.argv.slice(2);
const srcRoot = argv[argv.indexOf("--src") + 1];
if (!srcRoot || !fs.existsSync(srcRoot)) {
  console.error('pakai: node scripts/seed/prepare-audio.mjs --src "<folder sumber>"');
  process.exit(2);
}
const catalog = JSON.parse(fs.readFileSync("scripts/seed/catalog.json", "utf8"));
const wanted = new Set(catalog.songs.map((s) => s.key));
for (const k of wanted) if (!SOURCES[k]) throw new Error(`lagu "${k}" ada di catalog.json tetapi tidak ada di SOURCES`);
for (const k of Object.keys(SOURCES)) if (!wanted.has(k)) throw new Error(`SOURCES memuat "${k}" yang tidak ada di catalog.json`);

const outDir = "scripts/seed/audio";
fs.mkdirSync(outDir, { recursive: true });
const durations = {};
const rows = [];
let bad = 0;

for (const song of catalog.songs) {
  const [folder, file] = SOURCES[song.key];
  const src = path.join(srcRoot, folder, file);
  if (!fs.existsSync(src)) {
    console.error(`HILANG   ${song.key}: ${src}`);
    bad++;
    continue;
  }
  const out = path.join(outDir, `${song.key}.mp3`);
  const meta = await parseFile(src, { skipCovers: true });
  const kbpsIn = Math.round((meta.format.bitrate ?? 0) / 1000);
  let action = "salin";
  if (kbpsIn > RECOMMENDED_KBPS.max) {
    action = `ffmpeg ${RECOMMENDED_KBPS.max}k`;
    const r = spawnSync(ffmpegPath, ["-y", "-v", "error", "-i", src, "-vn", "-map_metadata", "-1", "-c:a", "libmp3lame", "-b:a", `${RECOMMENDED_KBPS.max}k`, out], { encoding: "utf8" });
    if (r.status !== 0) {
      console.error(`GAGAL    ${song.key}: ffmpeg ${r.stderr}`);
      bad++;
      continue;
    }
  } else {
    fs.copyFileSync(src, out);
  }
  const bytes = fs.readFileSync(out);
  const verdict = checkMp3(bytes.subarray(0, LIMITS.headBytes), bytes.length, undefined, CATALOG_MAX_BYTES);
  if (!verdict.ok) {
    console.error(`TOLAK    ${song.key}: validator MP3 -> ${verdict.reason}`);
    bad++;
    continue;
  }
  const outMeta = await parseFile(out, { skipCovers: true });
  const dur = Math.round(outMeta.format.duration ?? verdict.durationSec);
  durations[song.key] = dur;
  rows.push([song.key, `${kbpsIn}k`, `${Math.round(verdict.bitrateKbps)}k`, `${(fs.statSync(src).size / 1048576).toFixed(1)} MiB`, `${(bytes.length / 1048576).toFixed(1)} MiB`, `${dur}s`, action]);
}

console.log(["key", "masuk", "keluar", "ukuran masuk", "ukuran keluar", "durasi", "aksi"].join(" | "));
for (const r of rows) console.log(r.join(" | "));
fs.writeFileSync("scripts/seed/preview-durations.json", JSON.stringify(durations, null, 2) + "\n");
if (bad) {
  console.error(`\n${bad} lagu bermasalah`);
  process.exit(1);
}
console.log(`\n${rows.length} lagu siap di ${outDir}/ (tidak masuk git); durasi ditulis ke scripts/seed/preview-durations.json`);
