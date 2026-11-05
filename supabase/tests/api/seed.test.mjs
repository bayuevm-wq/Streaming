// seed.test.mjs: uji integrasi seed (F9) terhadap Supabase CLI lokal yang sudah berjalan.
// Memakai berkas sintetis (MP3 sunyi + PNG), BUKAN konten katalog. Memeriksa: unggah ke bucket publik, baris DB,
// idempotensi (jalan dua kali tidak menggandakan), dan bahwa klien (pengunjung anonim) hanya bisa MEMBACA katalog.
// Variabel: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Aturan validasi diuji offline di
// scripts/seed/validation.test.mjs.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { writeSample } from "../../../scripts/seed/make-sample.ts";

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY })) {
  if (!v) throw new Error(`${k} belum diatur`);
}
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opts);
const pass = (n, extra = "") => console.log(`PASS ${n}${extra ? ` [${extra}]` : ""}`);

const prefix = `seedtest${Date.now()}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "seed-int-"));
const catalogFile = writeSample(dir, prefix);
const keys = [1, 2, 3].map((n) => `${prefix}-${n}`);

const seed = () =>
  spawnSync(process.execPath, ["scripts/seed.ts", "--relaxed", "--catalog", catalogFile], {
    encoding: "utf8",
    env: { ...process.env, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY },
  });
const songs = async () => {
  const { data, error } = await admin.from("songs").select("*").in("seed_key", keys).order("seed_key");
  assert.equal(error, null, error?.message);
  return data;
};

// ---- jalan pertama ---------------------------------------------------------------------------------
const first = seed();
assert.equal(first.status, 0, `seed gagal:\n${first.stdout}\n${first.stderr}`);
assert.match(first.stdout, /baru: 2 artis, 2 album, 3 lagu/);
const rows1 = await songs();
assert.equal(rows1.length, 3);
for (const r of rows1) {
  assert.equal(r.visibility, "public");
  assert.equal(r.status, "ready");
  assert.equal(r.owner_id, null);
  assert.equal(r.expires_at, null);
  assert.ok(r.artist_id && r.audio_path.startsWith("seed/") && r.duration_sec >= 1 && r.size_bytes > 4096);
}
pass("seed pertama: 3 lagu publik berstatus ready dengan durasi dan ukuran terisi");

// ---- berkas di bucket publik dapat dibaca lewat URL publik -----------------------------------------
{
  const url = admin.storage.from("audio").getPublicUrl(rows1[0].audio_path).data.publicUrl;
  const res = await fetch(url, { headers: { Range: "bytes=0-3" } });
  assert.ok([200, 206].includes(res.status), `status ${res.status}`);
  assert.equal(res.headers.get("content-type"), "audio/mpeg");
  const head = new Uint8Array(await res.arrayBuffer()).subarray(0, 2);
  assert.deepEqual([...head], [0xff, 0xfb]);
  pass("audio dapat diunduh lewat URL publik dengan Content-Type audio/mpeg");
}

// ---- idempoten -------------------------------------------------------------------------------------
const second = seed();
assert.equal(second.status, 0, `seed kedua gagal:\n${second.stdout}\n${second.stderr}`);
assert.match(second.stdout, /baru: 0 artis, 0 album, 0 lagu \| lagu diperbarui: 3/);
assert.match(second.stdout, /berkas diunggah: 0/);
const rows2 = await songs();
assert.deepEqual(rows2.map((r) => r.id), rows1.map((r) => r.id), "id lagu berubah pada seed kedua");
const count = async (table, col, vals) => (await admin.from(table).select("*", { count: "exact", head: true }).in(col, vals)).count;
assert.equal(await count("songs", "seed_key", keys), 3);
assert.equal(await count("artists", "name_key", [`${prefix} artis a`.toLowerCase(), `${prefix} artis b`.toLowerCase()]), 2);
pass("seed kedua idempoten: tanpa duplikat, id tetap, tanpa unggah ulang");

// ---- klien hanya bisa membaca katalog --------------------------------------------------------------
{
  const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
  const { error: signErr } = await c.auth.signInAnonymously({ options: { captchaToken: "XXXX.DUMMY.TOKEN.XXXX" } });
  assert.equal(signErr, null, signErr?.message);
  const read = await c.from("songs").select("id,title").in("seed_key", keys);
  assert.equal(read.error, null, read.error?.message);
  assert.equal(read.data.length, 3, "pengunjung anonim harus bisa membaca katalog");
  const upd = await c.from("songs").update({ title: "diubah" }).in("seed_key", keys);
  assert.ok(upd.error, "pengunjung tak boleh mengubah katalog");
  const ins = await c.from("artists").insert({ name: "Palsu" });
  assert.ok(ins.error, "pengunjung tak boleh menambah artis");
  const up = await c.storage.from("audio").upload(`seed/${prefix}-hack.mp3`, new Uint8Array([1, 2, 3]), { contentType: "audio/mpeg" });
  assert.ok(up.error, "pengunjung tak boleh menulis ke bucket publik");
  pass("pengunjung anonim membaca katalog, tetapi tak bisa menulis tabel maupun bucket publik");
}
console.log("SEMUA LULUS");
