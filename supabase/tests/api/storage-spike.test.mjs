// storage-spike.test.mjs: spike S1 dan S2 (docs/architecture.md 14.1) terhadap Supabase CLI lokal yang sudah berjalan.
//   S1  signed URL bucket privat menjawab permintaan Range dengan 206 + Content-Range
//   S2  upload TUS (resumable, dua potongan) lolos policy INSERT `owns_pending_object` pada pembuatan DAN penyelesaian,
//       sedangkan path yang tidak dipesan / milik orang lain / sudah final / terlalu besar / bertipe salah ditolak
// Variabel: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import * as tus from "tus-js-client";

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY })) {
  if (!v) throw new Error(`${k} belum diatur`);
}
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opts);
const pass = (name, extra = "") => console.log(`PASS ${name}${extra ? ` [${extra}]` : ""}`);

async function signInAnon() {
  const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
  const { data, error } = await c.auth.signInAnonymously({ options: { captchaToken: "XXXX.DUMMY.TOKEN.XXXX" } });
  assert.equal(error, null, `sign-in anonim gagal: ${error?.message}`);
  return { c, user: data.user, token: data.session.access_token };
}

/** Unggah lewat protokol TUS persis seperti yang akan dilakukan browser. Mengembalikan { ok, error }. */
function tusUpload({ token, bucket, path, body, contentType, chunkSize = 6 * 1024 * 1024 }) {
  return new Promise((resolve) => {
    const upload = new tus.Upload(body, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [],
      headers: { authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: bucket, objectName: path, contentType, cacheControl: "3600" },
      chunkSize,
      onError: (error) => {
        const res = error.originalResponse;
        resolve({ ok: false, status: res?.getStatus?.(), body: res?.getBody?.() ?? String(error.message), error });
      },
      onSuccess: () => resolve({ ok: true }),
    });
    upload.start();
  });
}

const mp3Like = (bytes) => {
  const b = Buffer.alloc(bytes, 0x55);
  b.set([0xff, 0xfb, 0x90, 0x00], 0); // awal frame MPEG; isi tak diperiksa spike ini
  return b;
};
const reserve = async (c, title) => {
  const { data, error } = await c.rpc("reserve_upload", { p_title: title, p_artist_name: "Spike", p_cover_ext: "png" });
  assert.equal(error, null, `reserve_upload gagal: ${error?.message}`);
  return data;
};
const exists = async (bucket, path) => {
  const { data } = await admin.storage.from(bucket).download(path);
  return data !== null;
};

const A = await signInAnon();
const B = await signInAnon();

// ================================ S2: policy INSERT =====================================================
const SIZE = 7 * 1024 * 1024; // 7 MB > 6 MB: dua potongan PATCH, jadi "penyelesaian" ikut melewati policy
const res = await reserve(A.c, "Lagu spike");
assert.match(res.audio_path, new RegExp(`^${A.user.id}/[0-9a-f-]{36}\\.mp3$`));

{
  const r = await tusUpload({ token: A.token, bucket: "user-audio", path: res.audio_path, body: mp3Like(SIZE), contentType: "audio/mpeg" });
  assert.equal(r.ok, true, `TUS ke path yang dipesan seharusnya lolos: ${r.status} ${r.body}`);
  assert.equal(await exists("user-audio", res.audio_path), true, "objek harus ada di Storage setelah TUS selesai");
  pass("S2a TUS 2 potongan (7 MB) ke path yang dipesan lolos policy (pembuatan + penyelesaian)");
}
{
  const r = await tusUpload({ token: A.token, bucket: "user-covers", path: res.cover_path, body: Buffer.from("png-palsu-kecil"), contentType: "image/png" });
  assert.equal(r.ok, true, `TUS sampul ke path yang dipesan: ${r.status} ${r.body}`);
  pass("S2b TUS sampul (user-covers) ke path yang dipesan lolos");
}
{
  const path = `${A.user.id}/${crypto.randomUUID()}.mp3`;
  const r = await tusUpload({ token: A.token, bucket: "user-audio", path, body: mp3Like(2048), contentType: "audio/mpeg" });
  assert.equal(r.ok, false, "path yang TIDAK dipesan seharusnya ditolak");
  assert.equal(await exists("user-audio", path), false);
  pass("S2c upload ke path yang tidak dipesan ditolak", `${r.status}`);
}
{
  const r = await tusUpload({ token: B.token, bucket: "user-audio", path: res.audio_path, body: mp3Like(2048), contentType: "audio/mpeg" });
  assert.equal(r.ok, false, "pengunjung lain tak boleh menulis ke path reservasi A");
  pass("S2d pengunjung B tak bisa menulis ke path reservasi A", `${r.status}`);
}
{
  const r = await tusUpload({ token: A.token, bucket: "user-audio", path: res.audio_path, body: mp3Like(2048), contentType: "audio/mpeg" });
  assert.equal(r.ok, false, "menimpa objek yang sudah ada (tanpa upsert) seharusnya ditolak");
  pass("S2e tak bisa menimpa objek yang sudah ada", `${r.status}`);
}
{
  const r2 = await reserve(A.c, "Lagu terlalu besar");
  const r = await tusUpload({ token: A.token, bucket: "user-audio", path: r2.audio_path, body: mp3Like(10 * 1024 * 1024 + 1024), contentType: "audio/mpeg" });
  assert.equal(r.ok, false, "berkas > 10 MB seharusnya ditolak Storage");
  assert.equal(await exists("user-audio", r2.audio_path), false);
  pass("S2f berkas > 10 MB ditolak oleh file_size_limit bucket", `${r.status} ${String(r.body).slice(0, 80)}`);
  const r3 = await reserve(A.c, "Tipe salah");
  const bad = await tusUpload({ token: A.token, bucket: "user-audio", path: r3.audio_path, body: mp3Like(2048), contentType: "application/x-msdownload" });
  assert.equal(bad.ok, false, "Content-Type bukan audio/mpeg seharusnya ditolak");
  pass("S2g Content-Type di luar allowed_mime_types ditolak", `${bad.status}`);
}

// ================================ S1: Range pada signed URL =============================================
// Final dulu (service role, seperti Route Handler finalize), karena policy baca hanya untuk lagu yang terlihat (ready).
{
  const before = await A.c.storage.from("user-audio").createSignedUrl(res.audio_path, 3600);
  assert.ok(before.error, "sebelum finalize (pending) lagu tidak terlihat, signed URL seharusnya gagal");
  pass("S1-pra signed URL belum bisa dibuat selagi lagu masih pending", before.error.message);

  const fin = await admin.rpc("finalize_upload", { p_song_id: res.song_id, p_user_id: A.user.id, p_duration_sec: 120, p_size_bytes: SIZE });
  assert.equal(fin.error, null, `finalize_upload: ${fin.error?.message}`);

  const { data, error } = await A.c.storage.from("user-audio").createSignedUrl(res.audio_path, 3600);
  assert.equal(error, null, `createSignedUrl: ${error?.message}`);
  const url = data.signedUrl;

  const range = async (header) => fetch(url, { headers: { Range: header } });

  let r = await range("bytes=0-1023");
  assert.equal(r.status, 206, `Range awal: status ${r.status}`);
  assert.equal(r.headers.get("content-range"), `bytes 0-1023/${SIZE}`);
  assert.equal((await r.arrayBuffer()).byteLength, 1024);
  assert.equal(r.headers.get("accept-ranges"), "bytes");
  pass("S1a Range bytes=0-1023 -> 206 + Content-Range", r.headers.get("content-range"));

  r = await range(`bytes=${SIZE - 500}-`);
  assert.equal(r.status, 206);
  assert.equal(r.headers.get("content-range"), `bytes ${SIZE - 500}-${SIZE - 1}/${SIZE}`);
  assert.equal((await r.arrayBuffer()).byteLength, 500);
  pass("S1b Range terbuka (bytes=N-) -> 206 sampai akhir berkas", r.headers.get("content-range"));

  r = await range("bytes=-256");
  assert.equal(r.status, 206);
  assert.equal((await r.arrayBuffer()).byteLength, 256);
  pass("S1c Range sufiks (bytes=-256) -> 206, 256 byte terakhir", r.headers.get("content-range"));

  r = await range(`bytes=${SIZE + 10}-${SIZE + 20}`);
  assert.equal(r.status, 416, `Range di luar berkas: status ${r.status}`);
  pass("S1d Range di luar berkas -> 416", `${r.status}`);

  r = await fetch(url); // tanpa Range: 200 penuh (jalur fallback kode)
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("accept-ranges"), "bytes");
  await r.body?.cancel();
  pass("S1e tanpa Range -> 200 dan Accept-Ranges: bytes");

  // setelah final, path itu tidak lagi 'pending': upload ke sana ditolak (tak bisa mengganti file yang sudah divalidasi)
  const late = await tusUpload({ token: A.token, bucket: "user-audio", path: res.audio_path, body: mp3Like(2048), contentType: "audio/mpeg" });
  assert.equal(late.ok, false);
  pass("S2h setelah finalize, upload ke path itu ditolak", `${late.status}`);
}

for (const u of [A.user.id, B.user.id]) await admin.auth.admin.deleteUser(u).catch(() => {});
console.log("SEMUA LULUS");
