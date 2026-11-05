// Membuat berkas CONTOH untuk menguji pipeline seed: MP3 sunyi sintetis (struktur frame valid, bukan musik)
// dan PNG 1x1. Bukan konten katalog, dan tidak pernah di-commit. Dipakai uji integrasi di CI.
import fs from "node:fs";
import path from "node:path";

const FRAME = 417; // MPEG1 Layer III, 128 kbps, 44,1 kHz
export function silentMp3(seconds: number): Uint8Array {
  const frames = Math.max(8, Math.round((seconds * 16000) / FRAME));
  const out = new Uint8Array(frames * FRAME);
  for (let f = 0; f < frames; f++) out.set([0xff, 0xfb, 0x90, 0x00], f * FRAME);
  return out;
}

export const PNG_1X1 = Uint8Array.from(
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"),
);

/** Menulis 3 lagu, 2 album, 2 artis ke `dir`; mengembalikan jalur catalog.json. `prefix` membuat key unik per uji. */
export function writeSample(dir: string, prefix = "sample"): string {
  fs.mkdirSync(path.join(dir, "audio"), { recursive: true });
  fs.mkdirSync(path.join(dir, "covers"), { recursive: true });
  for (const n of [1, 2, 3]) fs.writeFileSync(path.join(dir, "audio", `${prefix}-${n}.mp3`), silentMp3(10 + n));
  fs.writeFileSync(path.join(dir, "covers", "cover.png"), PNG_1X1);
  const catalog = {
    artists: [{ name: `${prefix} Artis A`, image: "covers/cover.png" }, { name: `${prefix} Artis B` }],
    albums: [
      { artist: `${prefix} Artis A`, title: `${prefix} Album Satu`, year: 2024, cover: "covers/cover.png" },
      { artist: `${prefix} Artis B`, title: `${prefix} Album Dua`, year: 2025, cover: "covers/cover.png" },
    ],
    songs: [1, 2, 3].map((n) => ({
      key: `${prefix}-${n}`,
      title: `${prefix} Lagu ${n}`,
      artist: n < 3 ? `${prefix} Artis A` : `${prefix} Artis B`,
      album: n < 3 ? `${prefix} Album Satu` : `${prefix} Album Dua`,
      trackNo: n < 3 ? n : 1,
      file: `audio/${prefix}-${n}.mp3`,
      source: "berkas uji sintetis (bukan musik)",
      license: "CC0 1.0",
    })),
  };
  const file = path.join(dir, "catalog.json");
  fs.writeFileSync(file, JSON.stringify(catalog, null, 2));
  return file;
}
