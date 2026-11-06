// Logika job pembersih F18 (docs/architecture.md 8). Dipisah dari index.ts (Deno) agar bisa diuji di Node terhadap
// Supabase CLI lokal. Menerima klien service role; tidak membaca env atau memakai API khusus Deno.
// Invarian: (1) baris/user tidak dihapus sebelum file-nya hilang; (2) user ditandai `deleting` lebih dulu; (3) idempoten.
import type { SupabaseClient } from "@supabase/supabase-js";

export const GRACE_MIN = 15;
const BUCKETS = ["user-audio", "user-covers"] as const;

export type Db = SupabaseClient;

export async function removeAll(db: Db, bucket: string, paths: string[]) {
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await db.storage.from(bucket).remove(paths.slice(i, i + 100));
    if (error) throw error; // JANGAN lanjut ke penghapusan baris
  }
}

/** Lagu pribadi yang kedaluwarsa lebih dari `graceMin` menit: file dulu, baris kemudian (cascade ke likes dan playlist_songs). */
export async function purgeExpiredSongs(db: Db, opts: { graceMin?: number; limit?: number } = {}) {
  const cutoff = new Date(Date.now() - (opts.graceMin ?? GRACE_MIN) * 60_000).toISOString();
  const { data: rows, error } = await db
    .from("songs")
    .select("id,audio_path,cover_path")
    .eq("visibility", "private")
    .lte("expires_at", cutoff)
    .order("expires_at")
    .limit(opts.limit ?? 200);
  if (error) throw error;
  if (!rows?.length) return { songs: 0 };
  await removeAll(db, "user-audio", rows.map((r) => r.audio_path as string));
  await removeAll(db, "user-covers", rows.flatMap((r) => (r.cover_path ? [r.cover_path as string] : [])));
  const { error: delErr } = await db.from("songs").delete().in("id", rows.map((r) => r.id as string));
  if (delErr) throw delErr;
  return { songs: rows.length };
}

async function purgePrefix(db: Db, bucket: string, uid: string) {
  for (let i = 0; i < 20; i++) { // batas aman agar tak berputar tanpa akhir
    const { data, error } = await db.storage.from(bucket).list(uid, { limit: 1000 });
    if (error) throw error;
    if (!data?.length) return;
    const { error: rmErr } = await db.storage.from(bucket).remove(data.map((o) => `${uid}/${o.name}`));
    if (rmErr) throw rmErr;
  }
  throw new Error(`prefix ${uid} tidak kosong setelah 20 putaran`);
}

/** Pengguna anonim tidak aktif: tombstone -> hapus semua objek di prefix uid -> hapus user (cascade). */
export async function purgeInactiveUsers(db: Db, opts: { inactive?: string; limit?: number } = {}) {
  const { data: ids, error } = await db.rpc("claim_inactive_anonymous_users", { p_inactive: opts.inactive ?? "7 days", p_limit: opts.limit ?? 50 });
  if (error) throw error;
  let deleted = 0;
  const failed: string[] = [];
  for (const uid of (ids ?? []) as string[]) {
    try {
      for (const bucket of BUCKETS) await purgePrefix(db, bucket, uid); // 1) FILE DULU
      const { error: e } = await db.auth.admin.deleteUser(uid); // 2) USER + CASCADE
      if (e) throw e;
      deleted++;
    } catch (e) {
      failed.push(uid);
      console.error("purge user gagal", uid, e); // tombstone tetap; diulang besok
    }
  }
  return { claimed: (ids as string[] | null)?.length ?? 0, deleted, failed: failed.length };
}

/** Objek Storage tanpa baris songs (kasus tak terduga), dibaca lewat SQL tetapi dihapus lewat Storage API. */
export async function purgeOrphans(db: Db, opts: { minAge?: string; limit?: number } = {}) {
  const { data, error } = await db.rpc("list_orphan_objects", { p_min_age: opts.minAge ?? "1 day", p_limit: opts.limit ?? 500 });
  if (error) throw error;
  const rows = (data ?? []) as { bucket: string; object_name: string }[];
  for (const bucket of BUCKETS) await removeAll(db, bucket, rows.filter((o) => o.bucket === bucket).map((o) => o.object_name));
  return { orphans: rows.length };
}

export type Task = "songs" | "users" | "orphans";
export const isTask = (t: string): t is Task => t === "songs" || t === "users" || t === "orphans";

/** Satu tugas dengan lease (mencegah dua job berjalan tumpang tindih) dan hasil tercatat di job_leases.last_result. */
export async function runTask(db: Db, task: Task, opts: Record<string, unknown> = {}) {
  const { data: got, error: leaseErr } = await db.rpc("acquire_job_lease", { p_name: task, p_ttl: "10 minutes" });
  if (leaseErr) throw leaseErr;
  if (!got) return { status: 200, body: { skipped: "lease_held" } };
  try {
    const result = task === "songs" ? await purgeExpiredSongs(db, opts) : task === "users" ? await purgeInactiveUsers(db, opts) : await purgeOrphans(db, opts);
    await db.rpc("release_job_lease", { p_name: task, p_result: result });
    return { status: 200, body: result };
  } catch (e) {
    await db.rpc("release_job_lease", { p_name: task, p_result: { error: String(e) } });
    return { status: 500, body: { error: String(e) } };
  }
}

/** Perbandingan string waktu-konstan untuk rahasia. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
