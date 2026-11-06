// Aturan upload yang murni (tanpa React/Supabase/Node API) agar bisa diuji unit dan dipakai klien maupun server.
// Cek di sini hanyalah L0 (UX cepat, bisa dilewati); keputusan sebenarnya ada di database, Storage, dan `finalize`
// (docs/architecture.md 6.3).

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const MAX_COVER_BYTES = 2 * 1024 * 1024;
export const MAX_ACTIVE_SONGS = 3;
export const TTL_HOURS = 24;

export type UploadCode =
  | "not_mp3"
  | "too_large"
  | "too_small"
  | "bad_cover"
  | "cover_too_large"
  | "quota_exceeded"
  | "storage_full"
  | "reservation_expired"
  | "upload_incomplete"
  | "unauthenticated"
  | "account_not_active"
  | "invalid_meta"
  | "network"
  | "unknown";

export type Problem = { code: UploadCode; message: string; /** Kode teknis singkat untuk diagnosis, mis. "finalize 403 bad_origin". */ detail?: string };

const MB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1).replace(".", ",");

export const MESSAGES: Record<UploadCode, string> = {
  not_mp3: "Berkas ini bukan MP3 yang valid. Hanya file MP3 (.mp3) yang diterima; mengganti nama file tidak mengubah isinya.",
  too_large: "Berkas terlalu besar. Maksimum 10 MB per lagu.",
  too_small: "Berkas terlalu kecil untuk menjadi lagu MP3 yang valid.",
  bad_cover: "Sampul bukan gambar JPG, PNG, atau WebP yang valid.",
  cover_too_large: "Sampul terlalu besar. Maksimum 2 MB.",
  quota_exceeded: "Kamu sudah memakai 3 dari 3 slot lagu pribadi. Hapus satu lagu atau tunggu hingga kedaluwarsa (24 jam).",
  storage_full: "Upload sedang ditutup sementara karena penyimpanan penuh. Coba lagi nanti.",
  reservation_expired: "Waktu unggah habis (lebih dari 15 menit sejak dimulai). Mulai lagi dengan menekan Unggah.",
  upload_incomplete: "Unggahan belum selesai diterima server. Coba lagi.",
  unauthenticated: "Sesi kamu berakhir. Muat ulang halaman lalu masuk lagi.",
  account_not_active: "Akunmu sedang tidak aktif, jadi belum bisa mengunggah. Muat ulang halaman lalu masuk lagi.",
  invalid_meta: "Judul dan artis wajib diisi (maksimal 120 karakter).",
  network: "Koneksi terputus saat mengunggah. Tidak ada data setengah jadi yang tersisa; coba lagi.",
  unknown: "Unggahan gagal karena kesalahan yang tidak terduga. Coba lagi.",
};

export const problem = (code: UploadCode): Problem => ({ code, message: MESSAGES[code] });

const extOf = (name: string) => {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
};

/** Cek klien untuk berkas audio: ekstensi .mp3 (tanpa memandang huruf besar/kecil) dan ukuran. Isi diperiksa server. */
export function validateAudioFile(f: { name: string; size: number }): Problem | null {
  if (extOf(f.name) !== "mp3") return { code: "not_mp3", message: "Hanya file MP3 (.mp3) yang diterima." };
  if (f.size > MAX_AUDIO_BYTES) return { code: "too_large", message: `Berkas terlalu besar (${MB(f.size)} MB). Maksimum 10 MB per lagu.` };
  if (f.size === 0) return { code: "too_small", message: MESSAGES.too_small };
  return null;
}

export type CoverExt = "jpg" | "png" | "webp";
export function coverExt(name: string): CoverExt | null {
  const e = extOf(name);
  if (e === "jpg" || e === "jpeg") return "jpg";
  if (e === "png" || e === "webp") return e;
  return null;
}

export function validateCoverFile(f: { name: string; size: number }): Problem | null {
  if (!coverExt(f.name)) return { code: "bad_cover", message: "Sampul harus berformat JPG, PNG, atau WebP." };
  if (f.size > MAX_COVER_BYTES) return { code: "cover_too_large", message: `Sampul terlalu besar (${MB(f.size)} MB). Maksimum 2 MB.` };
  return null;
}

export const MIME = { mp3: "audio/mpeg", jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

export function validateMeta(m: { title: string; artist: string; album: string }): Problem | null {
  const t = m.title.trim();
  const a = m.artist.trim();
  if (!t || !a || t.length > 120 || a.length > 120 || m.album.trim().length > 120) return problem("invalid_meta");
  return null;
}

type DbErr = { code?: string | null; message?: string | null; hint?: string | null } | null | undefined;

/** Galat dari rpc('reserve_upload') -> kode. Trigger kuota/penyimpanan melempar P0001 dengan pesan tetap. */
export function fromReserveError(err: DbErr): UploadCode {
  const text = `${err?.message ?? ""} ${err?.hint ?? ""}`;
  if (/quota_exceeded/.test(text)) return "quota_exceeded";
  if (/storage_full/.test(text)) return "storage_full";
  if (/account_not_active/.test(text)) return "account_not_active";
  if (/not_authenticated/.test(text) || err?.code === "28000") return "unauthenticated";
  return "unknown";
}

/** Respons `finalize` (HTTP status + kode) -> kode. */
export function fromFinalize(status: number, code?: string | null): UploadCode {
  if (status === 410) return "reservation_expired";
  if (status === 401) return "unauthenticated";
  if (status === 409 && code === "upload_incomplete") return "upload_incomplete";
  if (status === 422) {
    if (code === "too_large") return "too_large";
    if (code === "too_small") return "too_small";
    if (code === "bad_cover") return "bad_cover";
    return "not_mp3"; // not_mp3, bad_mime, tag_too_large
  }
  return "unknown";
}

/** Galat TUS dari Storage (status HTTP) -> kode. 413 = file_size_limit, 415 = MIME, 403 = policy. */
export function fromStorageStatus(status: number | undefined): UploadCode {
  if (status === 413) return "too_large";
  if (status === 415) return "not_mp3";
  if (status === undefined) return "network";
  if (status === 401 || status === 403) return "reservation_expired"; // policy hanya mengizinkan reservasi yang masih pending
  return "unknown";
}

/** Sisa waktu hidup lagu pribadi, mis. "23 j 41 m", "41 m", "kurang dari 1 menit", "Kedaluwarsa". */
export function formatTimeLeft(ms: number): string {
  if (ms <= 0) return "Kedaluwarsa";
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 1) return "kurang dari 1 menit";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} j ${m} m` : `${m} m`;
}
