// Aturan katalog (spec F9 dan F19): fungsi murni tanpa I/O supaya mudah diuji.
//   - format: MP3 dan M4A saja (OGG tidak didukung: dukungan Safari tidak konsisten)
//   - ukuran: maks 15 MiB per file audio, 2 MiB per cover
//   - bitrate: disarankan 128-192 kbps (peringatan, bukan kegagalan)
//   - lisensi: HANYA CC0 1.0, CC BY 4.0, atau CC BY-SA 4.0. NC, ND, FMA-Limited, Pixabay, versi CC lain, dan yang tak dikenal ditolak
import { checkMp3, checkImage, LIMITS } from "../../lib/audio/mp3.ts";

export const CATALOG_MAX_BYTES = 15 * 1024 * 1024;
export const COVER_MAX_BYTES = 2 * 1024 * 1024;
export const RECOMMENDED_KBPS = { min: 128, max: 192 } as const;
export const MIN_COUNTS = { songs: 15, albums: 4, artists: 4 } as const;

/** Lisensi yang boleh dipakai katalog (ejaan baku). */
export const ALLOWED_LICENSES = ["CC0 1.0", "CC BY 4.0", "CC BY-SA 4.0"] as const;
/** Pembandingan toleran spasi, huruf besar/kecil, dan tanda hubung/garis bawah ("cc-by-sa-4.0" = "CC BY-SA 4.0"). */
const canon = (s: string) => s.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/s+/g, " ");
const ALLOWED_CANON = new Set(ALLOWED_LICENSES.map(canon));
const NON_COMMERCIAL = /(^|[^a-z])nc([^a-z]|$)|non-?commercial/i;
const NO_DERIVATIVES = /(^|[^a-z])nd([^a-z]|$)|no-?derivs?|no ?derivatives/i;
const FMA_LIMITED = /fma|limited/i;

export type CatalogSong = {
  key: string;
  title: string;
  artist: string;
  album?: string;
  trackNo?: number;
  file: string;
  cover?: string;
  source: string;
  license: string;
};
export type Catalog = {
  artists: { name: string; image?: string }[];
  albums: { artist: string; title: string; year?: number; cover?: string }[];
  songs: CatalogSong[];
};

export function licenseProblem(license: string): string | null {
  const l = license.trim();
  if (NON_COMMERCIAL.test(l)) return `lisensi non-komersial (NC) tidak boleh dipakai: "${license}"`;
  if (NO_DERIVATIVES.test(l)) return `lisensi tanpa-turunan (ND) tidak boleh dipakai: "${license}"`;
  if (FMA_LIMITED.test(l)) return `lisensi FMA-Limited tidak boleh dipakai: "${license}"`;
  if (!ALLOWED_CANON.has(canon(l))) {
    return `lisensi "${license}" tidak diizinkan; hanya ${ALLOWED_LICENSES.join(", ")}`;
  }
  return null;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Memeriksa bentuk katalog. `relaxed` mematikan syarat jumlah minimum dan syarat cover (untuk uji/contoh). */
export function catalogProblems(c: Catalog, relaxed: boolean): string[] {
  const p: string[] = [];
  const artists = new Set(c.artists.map((a) => norm(a.name)));
  if (artists.size !== c.artists.length) p.push("nama artis duplikat (tidak peka huruf besar/kecil)");
  const albumKey = (artist: string, title: string) => `${norm(artist)}\u0000${norm(title)}`;
  const albums = new Set(c.albums.map((a) => albumKey(a.artist, a.title)));
  if (albums.size !== c.albums.length) p.push("album duplikat (artis + judul)");
  const keys = new Set<string>();

  for (const a of c.albums) {
    if (!artists.has(norm(a.artist))) p.push(`album "${a.title}": artis "${a.artist}" tidak ada di daftar artis`);
    if (!relaxed && !a.cover) p.push(`album "${a.title}": cover wajib`);
    if (a.year !== undefined && !(Number.isInteger(a.year) && a.year >= 1900 && a.year <= 2100)) {
      p.push(`album "${a.title}": tahun tidak valid`);
    }
  }
  for (const s of c.songs) {
    const where = `lagu "${s.title ?? s.key}"`;
    if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(s.key ?? "")) p.push(`${where}: key harus slug huruf kecil/angka/tanda hubung`);
    if (keys.has(s.key)) p.push(`${where}: key "${s.key}" duplikat`);
    keys.add(s.key);
    if (!s.title?.trim()) p.push(`${where}: judul kosong`);
    if (!artists.has(norm(s.artist ?? ""))) p.push(`${where}: artis "${s.artist}" tidak ada di daftar artis`);
    if (s.album && !albums.has(albumKey(s.artist, s.album))) p.push(`${where}: album "${s.album}" tidak ada untuk artis itu`);
    if (!s.source?.trim()) p.push(`${where}: source wajib (URL atau keterangan asal)`);
    if (!s.license?.trim()) p.push(`${where}: license wajib`);
    else {
      const lp = licenseProblem(s.license);
      if (lp) p.push(`${where}: ${lp}`);
    }
    if (!relaxed) {
      const album = s.album ? c.albums.find((a) => albumKey(a.artist, a.title) === albumKey(s.artist, s.album!)) : undefined;
      if (!s.cover && !album?.cover) p.push(`${where}: butuh cover (sendiri atau dari album)`);
    }
  }
  if (!relaxed) {
    if (c.songs.length < MIN_COUNTS.songs) p.push(`hanya ${c.songs.length} lagu; minimal ${MIN_COUNTS.songs}`);
    if (c.albums.length < MIN_COUNTS.albums) p.push(`hanya ${c.albums.length} album; minimal ${MIN_COUNTS.albums}`);
    if (c.artists.length < MIN_COUNTS.artists) p.push(`hanya ${c.artists.length} artis; minimal ${MIN_COUNTS.artists}`);
  }
  return p;
}

export type AudioCheck =
  | { ok: true; ext: "mp3" | "m4a"; contentType: string; durationSec: number | null; bitrateKbps: number | null; warnings: string[] }
  | { ok: false; reason: string };

const M4A_BRANDS = ["M4A ", "M4B ", "mp42", "mp41", "isom", "iso2"];
const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));

/**
 * Memeriksa file audio katalog dari ISI-nya, bukan nama berkasnya.
 * Durasi/bitrate M4A tidak dapat dihitung di sini (perlu parser MP4): dikembalikan null untuk diisi pemanggil.
 */
export function checkCatalogAudio(file: Uint8Array, filename: string): AudioCheck {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext !== "mp3" && ext !== "m4a") {
    return { ok: false, reason: `format ".${ext}" tidak didukung; hanya MP3 dan M4A (OGG tidak didukung karena dukungan Safari tidak konsisten)` };
  }
  if (file.length > CATALOG_MAX_BYTES) {
    return { ok: false, reason: `ukuran ${(file.length / 1048576).toFixed(1)} MiB melebihi batas 15 MiB` };
  }
  const warnings: string[] = [];

  if (ext === "m4a") {
    if (file.length < 4096 || ascii(file, 4, 4) !== "ftyp" || !M4A_BRANDS.includes(ascii(file, 8, 4))) {
      return { ok: false, reason: "isi file bukan M4A/MP4 audio yang valid (kotak ftyp tidak ditemukan)" };
    }
    return { ok: true, ext, contentType: "audio/mp4", durationSec: null, bitrateKbps: null, warnings };
  }

  let v = checkMp3(file.subarray(0, LIMITS.headBytes), file.length, undefined, CATALOG_MAX_BYTES);
  if (!v.ok && v.reason === "need_window") {
    const win = { offset: v.needFrom, bytes: file.subarray(v.needFrom, v.needFrom + LIMITS.windowBytes) };
    v = checkMp3(file.subarray(0, LIMITS.headBytes), file.length, win, CATALOG_MAX_BYTES);
  }
  if (!v.ok) return { ok: false, reason: `isi file bukan MP3 yang valid (${v.reason})` };
  if (v.bitrateKbps < RECOMMENDED_KBPS.min || v.bitrateKbps > RECOMMENDED_KBPS.max) {
    warnings.push(`bitrate ${v.bitrateKbps} kbps di luar anjuran ${RECOMMENDED_KBPS.min}-${RECOMMENDED_KBPS.max} kbps`);
  }
  return { ok: true, ext, contentType: "audio/mpeg", durationSec: v.durationSec, bitrateKbps: v.bitrateKbps, warnings };
}

export type ImageCheck = { ok: true; ext: "jpg" | "png" | "webp"; contentType: string } | { ok: false; reason: string };

export function checkCatalogImage(file: Uint8Array, filename: string): ImageCheck {
  const raw = filename.toLowerCase().split(".").pop() ?? "";
  const ext = raw === "jpeg" ? "jpg" : raw;
  if (ext !== "jpg" && ext !== "png" && ext !== "webp") return { ok: false, reason: `cover ".${raw}" tidak didukung (JPG, PNG, WebP)` };
  if (file.length > COVER_MAX_BYTES) return { ok: false, reason: `cover ${(file.length / 1048576).toFixed(1)} MiB melebihi batas 2 MiB` };
  if (!checkImage(file, ext)) return { ok: false, reason: `isi file bukan ${ext.toUpperCase()} yang valid` };
  const contentType = ext === "jpg" ? "image/jpeg" : ext === "png" ? "image/png" : "image/webp";
  return { ok: true, ext, contentType };
}
