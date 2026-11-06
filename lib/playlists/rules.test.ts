import assert from "node:assert/strict";
import { describePlaylistError, validatePlaylistName } from "./rules.ts";

const t = (name: string, fn: () => void) => {
  fn();
  console.log(`PASS ${name}`);
};

t("nama dipangkas", () => assert.deepEqual(validatePlaylistName("  Santai  "), { ok: true, name: "Santai" }));
t("nama kosong/spasi ditolak", () => {
  assert.equal(validatePlaylistName("").ok, false);
  assert.equal(validatePlaylistName("   ").ok, false);
});
t("60 karakter boleh, 61 ditolak", () => {
  assert.equal(validatePlaylistName("a".repeat(60)).ok, true);
  assert.equal(validatePlaylistName("a".repeat(61)).ok, false);
});
t("emoji dihitung per karakter, bukan per unit UTF-16", () => assert.equal(validatePlaylistName("🎵".repeat(60)).ok, true));

t("batas 20 playlist", () => {
  const d = describePlaylistError({ code: "P0001", message: "playlist_limit", hint: "maks 20 playlist" }, "create");
  assert.equal(d.kind, "limit");
  assert.match(d.message, /20 playlist/);
});
t("batas 200 lagu menyebut nama playlist", () => {
  const d = describePlaylistError({ code: "P0001", message: "playlist_song_limit" }, "add", "Santai");
  assert.equal(d.kind, "limit");
  assert.match(d.message, /“Santai”.*200 lagu/);
});
t("lagu ganda = 'Sudah ada di playlist'", () => {
  const d = describePlaylistError({ code: "23505", message: "duplicate key value" }, "add", "Santai");
  assert.equal(d.kind, "duplicate");
  assert.equal(d.message, "Sudah ada di playlist “Santai”.");
});
t("23505 pada aksi lain bukan duplikat lagu", () => assert.equal(describePlaylistError({ code: "23505" }, "create").kind, "error"));
t("galat umum tidak membocorkan pesan mentah", () => {
  const d = describePlaylistError({ code: "XX000", message: "connection reset by peer 10.0.0.5" }, "remove");
  assert.equal(d.kind, "error");
  assert.doesNotMatch(d.message, /10\.0\.0\.5/);
});
console.log("SEMUA LULUS");
