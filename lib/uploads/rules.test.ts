import assert from "node:assert/strict";
import {
  coverExt, formatTimeLeft, fromFinalize, fromReserveError, fromStorageStatus, MAX_AUDIO_BYTES, MESSAGES,
  validateAudioFile, validateCoverFile, validateMeta,
} from "./rules.ts";

const t = (name: string, fn: () => void) => {
  fn();
  console.log(`PASS ${name}`);
};

t("audio: .mp3 sah (huruf besar juga), ukuran batas boleh", () => {
  assert.equal(validateAudioFile({ name: "a.mp3", size: 1000 }), null);
  assert.equal(validateAudioFile({ name: "LAGU.MP3", size: MAX_AUDIO_BYTES }), null);
});
t("audio: ekstensi lain ditolak (wav, m4a, exe, tanpa ekstensi, mp3.exe)", () => {
  for (const name of ["a.wav", "a.m4a", "a.exe", "a", "a.mp3.exe", ".mp3x"]) assert.equal(validateAudioFile({ name, size: 1000 })?.code, "not_mp3", name);
});
t("audio: > 10 MB ditolak dengan ukuran di pesan; kosong ditolak", () => {
  const p = validateAudioFile({ name: "a.mp3", size: MAX_AUDIO_BYTES + 1 });
  assert.equal(p?.code, "too_large");
  assert.match(p!.message, /10,0 MB|10 MB/);
  assert.equal(validateAudioFile({ name: "a.mp3", size: 0 })?.code, "too_small");
});
t("sampul: jpg/jpeg/png/webp, > 2 MB ditolak, format lain ditolak", () => {
  assert.equal(coverExt("x.JPEG"), "jpg");
  assert.equal(validateCoverFile({ name: "x.png", size: 100 }), null);
  assert.equal(validateCoverFile({ name: "x.gif", size: 100 })?.code, "bad_cover");
  assert.equal(validateCoverFile({ name: "x.png", size: 2 * 1024 * 1024 + 1 })?.code, "cover_too_large");
});
t("metadata: judul dan artis wajib, maks 120", () => {
  assert.equal(validateMeta({ title: "a", artist: "b", album: "" }), null);
  assert.equal(validateMeta({ title: "  ", artist: "b", album: "" })?.code, "invalid_meta");
  assert.equal(validateMeta({ title: "a", artist: "", album: "" })?.code, "invalid_meta");
  assert.equal(validateMeta({ title: "a".repeat(121), artist: "b", album: "" })?.code, "invalid_meta");
});
t("galat reserve_upload: kuota, penyimpanan penuh, akun, sesi", () => {
  assert.equal(fromReserveError({ code: "P0001", message: "quota_exceeded", hint: "maks 3 lagu pribadi aktif" }), "quota_exceeded");
  assert.equal(fromReserveError({ code: "P0001", message: "storage_full" }), "storage_full");
  assert.equal(fromReserveError({ code: "P0001", message: "account_not_active" }), "account_not_active");
  assert.equal(fromReserveError({ code: "28000", message: "not_authenticated" }), "unauthenticated");
  assert.equal(fromReserveError({ message: "sesuatu" }), "unknown");
});
t("respons finalize: 410 kedaluwarsa, 422 bukan MP3, 409 belum selesai", () => {
  assert.equal(fromFinalize(410), "reservation_expired");
  assert.equal(fromFinalize(422, "not_mp3"), "not_mp3");
  assert.equal(fromFinalize(422, "bad_mime"), "not_mp3");
  assert.equal(fromFinalize(422, "too_large"), "too_large");
  assert.equal(fromFinalize(422, "bad_cover"), "bad_cover");
  assert.equal(fromFinalize(409, "upload_incomplete"), "upload_incomplete");
  assert.equal(fromFinalize(500), "unknown");
});
t("status Storage: 413 besar, 415 MIME, tanpa respons = jaringan, 403 = reservasi", () => {
  assert.equal(fromStorageStatus(413), "too_large");
  assert.equal(fromStorageStatus(415), "not_mp3");
  assert.equal(fromStorageStatus(undefined), "network");
  assert.equal(fromStorageStatus(403), "reservation_expired");
});
t("sisa waktu: jam+menit, menit, kurang dari semenit, kedaluwarsa", () => {
  const m = 60_000;
  assert.equal(formatTimeLeft(23 * 60 * m + 41 * m + 30_000), "23 j 41 m");
  assert.equal(formatTimeLeft(41 * m), "41 m");
  assert.equal(formatTimeLeft(59_000), "kurang dari 1 menit");
  assert.equal(formatTimeLeft(0), "Kedaluwarsa");
  assert.equal(formatTimeLeft(-5), "Kedaluwarsa");
  assert.equal(formatTimeLeft(60 * m), "1 j 0 m");
});
t("semua kode punya pesan tak kosong", () => {
  for (const [k, v] of Object.entries(MESSAGES)) assert.ok(v.length > 10, k);
});
console.log("SEMUA LULUS");
