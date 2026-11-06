import "server-only";
import { checkImage, checkMp3, LIMITS } from "@/lib/audio/mp3";
import { adminClient, type Admin } from "@/lib/supabase/admin";
import { requestIsSameOrigin } from "@/lib/security/origin";
import { currentUser } from "@/lib/supabase/server";

// Langkah 3-4 upload (docs/architecture.md 6.2/6.4): periksa ISI file di server lalu finalize_upload.
// Handler tidak membandingkan waktu: kedaluwarsa reservasi diputuskan finalize_upload dengan now() database.

type SongRow = { id: string; owner_id: string; status: string; audio_path: string; cover_path: string | null };

const fail = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!requestIsSameOrigin(req)) return fail(403, "bad_origin"); // CSRF
  const user = await currentUser();
  if (!user) return fail(401, "unauthenticated");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, "not_found");

  const db = adminClient();
  const { data } = await db
    .from("songs")
    .select("id,owner_id,status,audio_path,cover_path")
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("visibility", "private")
    .maybeSingle();
  const song = data as SongRow | null;
  if (!song) return fail(404, "not_found");
  if (song.status === "ready") return Response.json({ ok: true }); // idempoten

  const audio = await readRange(db, "user-audio", song.audio_path, 0, LIMITS.headBytes);
  if (!audio) return fail(409, "upload_incomplete"); // belum selesai diunggah (atau sudah dibersihkan)
  if (audio.contentType !== "audio/mpeg") return reject(db, song, "bad_mime");

  let v = checkMp3(audio.bytes, audio.total);
  if (!v.ok && v.reason === "need_window") {
    // tag ID3 melewati 64 KiB: baca jendela kedua tepat di titik frame pertama
    const w = await readRange(db, "user-audio", song.audio_path, v.needFrom, LIMITS.windowBytes);
    if (w) v = checkMp3(audio.bytes, audio.total, { offset: v.needFrom, bytes: w.bytes });
  }
  if (!v.ok) return reject(db, song, v.reason === "need_window" ? "not_mp3" : v.reason);

  if (song.cover_path) {
    const ext = song.cover_path.split(".").pop() as "jpg" | "png" | "webp";
    const c = await readRange(db, "user-covers", song.cover_path, 0, 16);
    // Sampul bersifat opsional: bila belum/tidak terunggah atau tidak valid, tolak seluruh unggahan agar tak ada setengah jadi.
    if (!c || c.total > 2 * 1024 * 1024 || !checkImage(c.bytes, ext)) return reject(db, song, "bad_cover");
  }

  const { error } = await db.rpc("finalize_upload", {
    p_song_id: id,
    p_user_id: user.id,
    p_duration_sec: v.durationSec,
    p_size_bytes: audio.total,
  });
  if (error?.code === "P0003") return fail(410, "reservation_expired");
  if (error) return fail(409, "reservation_invalid");
  return Response.json({ ok: true, durationSec: v.durationSec });
}

async function readRange(db: Admin, bucket: string, path: string, from: number, len: number) {
  const { data } = await db.storage.from(bucket).createSignedUrl(path, 60);
  if (!data) return null; // objek belum ada
  const r = await fetch(data.signedUrl, { headers: { Range: `bytes=${from}-${from + len - 1}` } });
  if (r.status !== 206 && r.status !== 200) return null;
  const buf = new Uint8Array(await r.arrayBuffer());
  const total = Number(r.headers.get("content-range")?.split("/")[1] ?? r.headers.get("content-length"));
  // S1 membuktikan Storage membalas 206; bila suatu saat membalas 200 (Range diabaikan), potong sendiri.
  return { bytes: r.status === 200 ? buf.subarray(from, from + len) : buf, total, contentType: r.headers.get("content-type") };
}

async function reject(db: Admin, song: SongRow, reason: string) {
  // expires_at = now() DI DATABASE: slot langsung bebas; lalu hapus file. Sisa baris dibersihkan job per jam.
  await db.rpc("reject_upload", { p_song_id: song.id, p_user_id: song.owner_id });
  await db.storage.from("user-audio").remove([song.audio_path]);
  if (song.cover_path) await db.storage.from("user-covers").remove([song.cover_path]);
  return fail(422, reason);
}
