// cleanup.test.mjs: job pembersih F18 (supabase/functions/cleanup/logic.ts) terhadap Supabase CLI lokal sungguhan.
// Membuktikan: file dihapus SEBELUM baris (dan baris tetap bila penghapusan file gagal), masa tenggang 15 menit, cascade
// ke likes dan playlist_songs, tombstone + pemulihan user, objek yatim, dan lease. Edge Function (Deno) hanya membungkus
// logic.ts; pembungkusnya (autentikasi rahasia) diuji terpisah di unit safeEqual dan belum di runtime Deno.
// Variabel: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import * as tus from "tus-js-client";
import { purgeExpiredSongs, purgeInactiveUsers, purgeOrphans, runTask, safeEqual } from "../../functions/cleanup/logic.ts";

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY })) if (!v) throw new Error(`${k} belum diatur`);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opts);
const pass = (n, extra = "") => console.log(`PASS ${n}${extra ? ` [${extra}]` : ""}`);
const ago = (min) => new Date(Date.now() - min * 60_000).toISOString();

async function signInAnon() {
  const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
  const { data, error } = await c.auth.signInAnonymously({ options: { captchaToken: "XXXX.DUMMY.TOKEN.XXXX" } });
  assert.equal(error, null, error?.message);
  return { c, user: data.user, token: data.session.access_token };
}
const mp3 = (n) => {
  const b = Buffer.alloc(n, 0x55);
  b.set([0xff, 0xfb, 0x90, 0x00], 0);
  return b;
};
function tusUpload(token, bucket, path, body, contentType) {
  return new Promise((resolve, reject) => {
    new tus.Upload(body, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [],
      headers: { authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
      uploadDataDuringCreation: true,
      metadata: { bucketName: bucket, objectName: path, contentType, cacheControl: "3600" },
      chunkSize: 6 * 1024 * 1024,
      onError: reject,
      onSuccess: () => resolve(),
    }).start();
  });
}
/** Reservasi + unggah + finalize, seperti alur nyata. */
async function readySong(u, title) {
  const { data, error } = await u.c.rpc("reserve_upload", { p_title: title, p_artist_name: "Uji" });
  assert.equal(error, null, error?.message);
  await tusUpload(u.token, "user-audio", data.audio_path, mp3(8192), "audio/mpeg");
  const fin = await admin.rpc("finalize_upload", { p_song_id: data.song_id, p_user_id: u.user.id, p_duration_sec: 30, p_size_bytes: 8192 });
  assert.equal(fin.error, null, fin.error?.message);
  return data;
}
const fileExists = async (bucket, path) => (await admin.storage.from(bucket).download(path)).data !== null;
const rowExists = async (table, col, val) => ((await admin.from(table).select("*", { count: "exact", head: true }).eq(col, val)).count ?? 0) > 0;
const setExpiry = (id, iso) => admin.from("songs").update({ expires_at: iso }).eq("id", id);

/** Klien palsu: Storage selalu gagal menghapus; sisanya diteruskan ke klien asli. */
const failingStorage = new Proxy(admin, {
  get(target, prop) {
    if (prop === "storage") return { from: () => ({ remove: async () => ({ error: new Error("storage down") }), list: async () => ({ data: [{ name: "x" }], error: null }) }) };
    const v = target[prop];
    return typeof v === "function" ? v.bind(target) : v;
  },
});

const A = await signInAnon();

// ================= songs =================
const old = await readySong(A, "Sudah lama");
const recent = await readySong(A, "Baru saja");
await A.c.from("likes").insert({ song_id: old.song_id }); // like dan playlist atas lagu pribadi (sebelum kedaluwarsa)
const pl = await A.c.from("playlists").insert({ name: "Uji" }).select("id").single();
await A.c.from("playlist_songs").insert({ playlist_id: pl.data.id, song_id: old.song_id });
assert.equal(await rowExists("likes", "song_id", old.song_id), true);

await setExpiry(old.song_id, ago(20)); // lewat masa tenggang 15 menit
await setExpiry(recent.song_id, ago(5)); // sudah tak terbaca, tetapi masih dalam masa tenggang

{
  await assert.rejects(() => purgeExpiredSongs(failingStorage), /storage down/);
  assert.equal(await rowExists("songs", "id", old.song_id), true, "baris TIDAK boleh dihapus bila penghapusan file gagal");
  assert.equal(await fileExists("user-audio", old.audio_path), true);
  pass("songs: penghapusan file gagal -> galat dilempar dan baris tetap ada (invarian 1)");
}
{
  const r = await purgeExpiredSongs(admin);
  assert.ok(r.songs >= 1, JSON.stringify(r));
  assert.equal(await fileExists("user-audio", old.audio_path), false, "file lama harus terhapus");
  assert.equal(await rowExists("songs", "id", old.song_id), false);
  assert.equal(await rowExists("likes", "song_id", old.song_id), false, "like ikut terhapus (cascade)");
  assert.equal(await rowExists("playlist_songs", "song_id", old.song_id), false, "isi playlist ikut terhapus (cascade)");
  assert.equal((await admin.from("playlists").select("id").eq("id", pl.data.id)).data.length, 1, "playlist itu sendiri tetap ada");
  pass("songs: file lalu baris dihapus, cascade ke likes dan playlist_songs, playlist tetap", `songs=${r.songs}`);
  assert.equal(await rowExists("songs", "id", recent.song_id), true);
  assert.equal(await fileExists("user-audio", recent.audio_path), true);
  pass("songs: lagu yang baru kedaluwarsa 5 menit (dalam masa tenggang 15 menit) belum disentuh");
  const again = await purgeExpiredSongs(admin);
  assert.ok(again.songs >= 0);
  pass("songs: dijalankan ulang aman (idempoten)");
}

// ================= orphans =================
{
  const stray = `${A.user.id}/yatim-${Date.now()}.mp3`;
  const up = await admin.storage.from("user-audio").upload(stray, mp3(5000), { contentType: "audio/mpeg" });
  assert.equal(up.error, null, up.error?.message);
  const r = await purgeOrphans(admin, { minAge: "0 seconds" });
  assert.ok(r.orphans >= 1, JSON.stringify(r));
  assert.equal(await fileExists("user-audio", stray), false, "objek yatim terhapus lewat Storage API");
  assert.equal(await fileExists("user-audio", recent.audio_path), true, "objek yang punya baris songs TIDAK boleh dihapus");
  pass("orphans: objek tanpa baris dihapus, objek yang punya baris aman", `orphans=${r.orphans}`);
}

// ================= users =================
const C = await signInAnon();
const cSong = await readySong(C, "Milik C");
const D = await signInAnon();
{
  await admin.from("profiles").update({ last_seen_at: ago(8 * 24 * 60) }).eq("user_id", C.user.id);
  const r = await purgeInactiveUsers(admin);
  assert.ok(r.deleted >= 1 && r.failed === 0, JSON.stringify(r));
  assert.equal(await fileExists("user-audio", cSong.audio_path), false, "file user dihapus");
  assert.ok((await admin.auth.admin.getUserById(C.user.id)).error, "user terhapus");
  assert.equal(await rowExists("songs", "id", cSong.song_id), false, "baris lagu ikut terhapus (cascade)");
  assert.equal(await rowExists("profiles", "user_id", C.user.id), false);
  assert.equal((await admin.auth.admin.getUserById(A.user.id)).error, null, "user aktif TIDAK disentuh");
  pass("users: tombstone, file, lalu user dihapus dengan cascade; user aktif aman", `deleted=${r.deleted}`);
}
{
  // gagal di tengah: user tetap 'deleting' (invarian 2), lalu pulih pada putaran berikutnya
  const dSong = await readySong(D, "Milik D");
  await admin.from("profiles").update({ last_seen_at: ago(8 * 24 * 60) }).eq("user_id", D.user.id);
  const bad = await purgeInactiveUsers(failingStorage);
  assert.equal(bad.failed, 1, JSON.stringify(bad));
  const prof = await admin.from("profiles").select("status").eq("user_id", D.user.id).single();
  assert.equal(prof.data.status, "deleting");
  assert.equal(await fileExists("user-audio", dSong.audio_path), true);
  const rsv = await D.c.rpc("reserve_upload", { p_title: "x", p_artist_name: "y" });
  assert.ok(rsv.error && /account_not_active/.test(rsv.error.message ?? ""), `user deleting tak boleh reservasi: ${rsv.error?.message}`);
  pass("users: kegagalan menahan user di 'deleting' dan reservasi baru ditolak (account_not_active)");
  const ok = await purgeInactiveUsers(admin);
  assert.ok(ok.deleted >= 1, JSON.stringify(ok));
  assert.ok((await admin.auth.admin.getUserById(D.user.id)).error);
  assert.equal(await fileExists("user-audio", dSong.audio_path), false);
  pass("users: putaran berikutnya menuntaskan user yang macet");
}

// ================= lease dan pencatatan hasil =================
{
  // uji SQL sebelumnya di database yang sama dapat meninggalkan lease "songs"; mulai dari keadaan bersih
  await admin.rpc("release_job_lease", { p_name: "songs", p_result: {} });
  const first = await admin.rpc("acquire_job_lease", { p_name: "songs", p_ttl: "10 minutes" });
  assert.equal(first.data, true);
  const skipped = await runTask(admin, "songs");
  assert.deepEqual(skipped, { status: 200, body: { skipped: "lease_held" } });
  await admin.rpc("release_job_lease", { p_name: "songs", p_result: {} });
  const ran = await runTask(admin, "songs");
  assert.equal(ran.status, 200);
  const lease = await admin.from("job_leases").select("last_result").eq("name", "songs").single();
  assert.ok("songs" in lease.data.last_result, JSON.stringify(lease.data));
  pass("lease: job tumpang tindih dilewati; hasil tercatat di job_leases.last_result");
}

assert.equal(safeEqual("Bearer abc", "Bearer abc"), true);
assert.equal(safeEqual("Bearer abc", "Bearer abd"), false);
assert.equal(safeEqual("a", "ab"), false);
pass("safeEqual: sama, beda, dan beda panjang");

await admin.storage.from("user-audio").remove([recent.audio_path]);
for (const id of [A.user.id]) await admin.auth.admin.deleteUser(id).catch(() => {});
console.log("SEMUA LULUS");
