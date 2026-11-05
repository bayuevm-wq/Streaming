// anonymous-signin.test.mjs: uji integrasi terhadap Supabase CLI lokal yang sudah berjalan.
//   S5  trigger profiles benar-benar berjalan saat signInAnonymously (bukan INSERT manual seperti di uji SQL)
//   F1  CAPTCHA ditegakkan SERVER: sign-in anonim tanpa token ditolak
//   S3  auth.admin.deleteUser meng-cascade profiles, playlists, dan lagu pribadi
//   +   isolasi data antar dua pengunjung lewat API (PostgREST) sungguhan
// Variabel: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// Token CAPTCHA: secret uji Turnstile (1x000...AA) menerima token apa pun, jadi cukup string sembarang.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY })) {
  if (!v) throw new Error(`${k} belum diatur`);
}
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const newClient = () => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opts);
const CAPTCHA = "XXXX.DUMMY.TOKEN.XXXX";
const pass = (name, extra = "") => console.log(`PASS ${name}${extra ? ` [${extra}]` : ""}`);

async function signInAnon() {
  const c = newClient();
  const { data, error } = await c.auth.signInAnonymously({ options: { captchaToken: CAPTCHA } });
  assert.equal(error, null, `sign-in anonim gagal: ${error?.message}`);
  return { c, user: data.user, session: data.session };
}

// ---- F1: CAPTCHA ditegakkan server -----------------------------------------------------------------
{
  const { data, error } = await newClient().auth.signInAnonymously();
  assert.ok(error, "sign-in anonim TANPA token CAPTCHA seharusnya ditolak");
  assert.equal(data.session, null);
  pass("F1 sign-in anonim tanpa token CAPTCHA ditolak server", `${error.status} ${error.code ?? error.message}`);
}

// ---- S5: trigger profiles saat signInAnonymously ---------------------------------------------------
const A = await signInAnon();
assert.equal(A.user.is_anonymous, true);
pass("F1 sign-in anonim dengan token berhasil, is_anonymous = true");
{
  const { data, error } = await admin.from("profiles").select("*").eq("user_id", A.user.id).single();
  assert.equal(error, null, `profiles A: ${error?.message}`);
  assert.equal(data.status, "active");
  assert.ok(Date.now() - new Date(data.last_seen_at).getTime() < 60_000, "last_seen_at harus baru");
  pass("S5 trigger on_auth_user_created membuat profiles saat signInAnonymously", `last_seen_at=${data.last_seen_at}`);
}

// ---- hak akses klien -------------------------------------------------------------------------------
{
  const status = await A.c.rpc("get_upload_status");
  assert.equal(status.error, null, status.error?.message);
  assert.deepEqual(status.data, { active: 0, max: 3, storage_open: true });
  const touch = await A.c.rpc("touch_last_seen");
  assert.equal(touch.error, null, touch.error?.message);
  const prof = await A.c.from("profiles").select("*");
  assert.ok(prof.error, "klien tak boleh membaca profiles");
  pass("hak akses: RPC milik user jalan, tabel profiles tertutup", prof.error.code);
}

// ---- isolasi dua pengunjung lewat API --------------------------------------------------------------
const B = await signInAnon();
assert.notEqual(A.user.id, B.user.id);
{
  const mk = await A.c.from("playlists").insert({ user_id: A.user.id, name: "Punya A" }).select().single();
  assert.equal(mk.error, null, mk.error?.message);
  const seenByB = await B.c.from("playlists").select("*");
  assert.equal(seenByB.error, null);
  assert.equal(seenByB.data.length, 0, "B tidak boleh melihat playlist A");
  const forged = await B.c.from("playlists").insert({ user_id: A.user.id, name: "Palsu" });
  assert.ok(forged.error, "B tak boleh membuat playlist atas nama A");
  pass("isolasi: playlist A tak terlihat B, pemalsuan user_id ditolak RLS");
}

// ---- reservasi upload lewat API + kuota ------------------------------------------------------------
{
  for (let i = 1; i <= 3; i++) {
    const r = await A.c.rpc("reserve_upload", { p_title: `T${i}`, p_artist_name: "Aku" });
    assert.equal(r.error, null, `reserve #${i}: ${r.error?.message}`);
    assert.ok(r.data.audio_path.startsWith(`${A.user.id}/`));
  }
  const fourth = await A.c.rpc("reserve_upload", { p_title: "T4", p_artist_name: "Aku" });
  assert.ok(fourth.error?.message.includes("quota_exceeded"), `reserve #4 harus quota_exceeded, dapat: ${fourth.error?.message}`);
  const visible = await A.c.from("songs").select("id");
  assert.equal(visible.data.length, 0, "baris pending tak boleh terlihat klien");
  pass("reserve_upload via API: 3 berhasil, ke-4 quota_exceeded, baris pending tak terlihat");
}

// ---- S3: auth.admin.deleteUser meng-cascade --------------------------------------------------------
{
  const count = async (table, col, id) => (await admin.from(table).select("*", { count: "exact", head: true }).eq(col, id)).count;
  assert.equal(await count("profiles", "user_id", A.user.id), 1);
  assert.equal(await count("playlists", "user_id", A.user.id), 1);
  assert.equal(await count("songs", "owner_id", A.user.id), 3);
  const del = await admin.auth.admin.deleteUser(A.user.id);
  assert.equal(del.error, null, del.error?.message);
  assert.equal(await count("profiles", "user_id", A.user.id), 0);
  assert.equal(await count("playlists", "user_id", A.user.id), 0);
  assert.equal(await count("songs", "owner_id", A.user.id), 0);
  pass("S3 auth.admin.deleteUser meng-cascade profiles, playlists, dan lagu pribadi");
  await admin.auth.admin.deleteUser(B.user.id);
}
console.log("SEMUA LULUS");
