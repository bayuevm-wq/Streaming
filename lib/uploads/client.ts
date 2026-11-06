"use client";

import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/client";
import {
  coverExt, fromFinalize, fromReserveError, fromStorageStatus, MIME, problem, validateAudioFile, validateCoverFile, validateMeta,
  type Problem,
} from "./rules";

// Orkestrasi unggah di browser (docs/architecture.md 6.2): reserve_upload -> TUS audio (+ sampul) -> finalize.
// Kegagalan di tahap mana pun membatalkan reservasi lewat DELETE /api/songs/:id agar tak ada data setengah jadi (F5).

export type UploadInput = { file: File; title: string; artist: string; album: string; cover: File | null };
export type UploadResult = { ok: true; songId: string } | { ok: false; problem: Problem };
export type Progress = { phase: "reserving" | "uploading" | "verifying"; percent: number };

type Reservation = { song_id: string; audio_path: string; cover_path: string | null };

export async function uploadSong(input: UploadInput, onProgress: (p: Progress) => void): Promise<UploadResult> {
  const bad = validateAudioFile(input.file) ?? (input.cover ? validateCoverFile(input.cover) : null) ?? validateMeta(input);
  if (bad) return { ok: false, problem: bad };

  const supabase = createClient();
  const cExt = input.cover ? coverExt(input.cover.name) : null;

  onProgress({ phase: "reserving", percent: 0 });
  const { data, error } = await supabase.rpc("reserve_upload", {
    p_title: input.title.trim(),
    p_artist_name: input.artist.trim(),
    p_album_name: input.album.trim() || null,
    p_cover_ext: cExt,
  });
  if (error || !data) return { ok: false, problem: problem(fromReserveError(error)) };
  const res = data as Reservation;

  const abort = async (p: Problem): Promise<UploadResult> => {
    // Pembatalan best-effort: lagu pending kedaluwarsa sendiri dalam 15 menit dan dibersihkan job bila ini gagal.
    await fetch(`/api/songs/${res.song_id}`, { method: "DELETE" }).catch(() => undefined);
    return { ok: false, problem: p };
  };

  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return abort(problem("unauthenticated"));

  // Berat relatif: audio dominan; sampul kecil.
  const audioErr = await tusUpload({ token, bucket: "user-audio", path: res.audio_path, file: input.file, contentType: MIME.mp3 }, (f) =>
    onProgress({ phase: "uploading", percent: Math.round(f * (input.cover ? 95 : 100)) }),
  );
  if (audioErr) return abort(problem(audioErr));

  if (input.cover && res.cover_path && cExt) {
    const coverErr = await tusUpload({ token, bucket: "user-covers", path: res.cover_path, file: input.cover, contentType: MIME[cExt] }, () => undefined);
    if (coverErr) return abort(problem(coverErr));
  }

  onProgress({ phase: "verifying", percent: 100 });
  let r: Response;
  try {
    r = await fetch(`/api/uploads/${res.song_id}/finalize`, { method: "POST" });
  } catch {
    return abort(problem("network"));
  }
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    const code = fromFinalize(r.status, body.error);
    // finalize sudah membatalkan reservasi untuk 422; untuk yang lain (409/410/5xx) pembatalan di sini aman dan idempoten
    return code === "not_mp3" || code === "too_large" || code === "too_small" || code === "bad_cover" ? { ok: false, problem: problem(code) } : abort(problem(code));
  }
  return { ok: true, songId: res.song_id };
}

/** TUS ke Storage. Mengembalikan kode galat atau null bila sukses. `contentType` DIPAKSA (bukan file.type), lihat 6.6. */
function tusUpload(
  o: { token: string; bucket: string; path: string; file: File; contentType: string },
  onFraction: (f: number) => void,
): Promise<ReturnType<typeof fromStorageStatus> | null> {
  return new Promise((resolve) => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const upload = new tus.Upload(o.file, {
      endpoint: `${url}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000],
      headers: { authorization: `Bearer ${o.token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024, // Storage mensyaratkan potongan 6 MB
      metadata: { bucketName: o.bucket, objectName: o.path, contentType: o.contentType, cacheControl: "3600" },
      onProgress: (sent, total) => onFraction(total > 0 ? sent / total : 0),
      onError: (err) => {
        const status = (err as tus.DetailedError).originalResponse?.getStatus();
        resolve(fromStorageStatus(status));
      },
      onSuccess: () => resolve(null),
    });
    upload.start();
  });
}

/** Hapus lagu pribadi milik sendiri (Route Handler). */
export async function deleteSong(songId: string): Promise<boolean> {
  try {
    const r = await fetch(`/api/songs/${songId}`, { method: "DELETE" });
    return r.ok;
  } catch {
    return false;
  }
}
