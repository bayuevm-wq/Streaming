// Uji logika pemutar dengan elemen audio palsu (tanpa browser). Jalankan: node lib/player/store.test.ts
// Perilaku audio sungguhan (currentTime naik lintas rute) diuji E2E di e2e/player-persistence.spec.ts.
import assert from "node:assert/strict";

class FakeAudio extends EventTarget {
  src = "";
  currentTime = 0;
  duration = Number.NaN;
  paused = true;
  volume = 1;
  preload = "";
  mode: "ok" | "notallowed" | "abort" = "ok";
  played: string[] = [];
  getAttribute(n: string) {
    return n === "src" && this.src ? this.src : null;
  }
  removeAttribute(n: string) {
    if (n === "src") this.src = "";
  }
  load() {}
  play() {
    if (this.mode === "notallowed") return Promise.reject(Object.assign(new Error("blocked"), { name: "NotAllowedError" }));
    this.paused = false;
    this.played.push(this.src);
    queueMicrotask(() => this.dispatchEvent(new Event("playing")));
    return Promise.resolve();
  }
  pause() {
    if (!this.paused) {
      this.paused = true;
      this.dispatchEvent(new Event("pause"));
    }
  }
  /** Mensimulasikan lagu selesai: browser mengirim pause lalu ended. */
  end() {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
    this.dispatchEvent(new Event("ended"));
  }
  fail() {
    this.dispatchEvent(new Event("error"));
  }
}
(globalThis as unknown as { Audio: unknown }).Audio = FakeAudio;

const { getAudio } = await import("./audio.ts");
const { usePlayer, useProgress, initPlayer, setUrlResolver } = await import("./store.ts");
import type { Track } from "./store.ts";

const tracks: Track[] = [1, 2, 3].map((n) => ({
  id: `t${n}`, title: `Lagu ${n}`, artist: "A", coverUrl: null, audioUrl: `https://x/${n}.mp3`, durationSec: 100 + n, visibility: "public",
}));
const audio = () => getAudio() as unknown as FakeAudio;
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const pass = (n: string) => console.log(`PASS ${n}`);
const P = () => usePlayer.getState();

initPlayer();
initPlayer(); // idempoten: pendengar tidak boleh terpasang dua kali
function fresh() {
  P().reset();
  audio().mode = "ok";
  audio().played = [];
  audio().currentTime = 0;
  setUrlResolver(async (t) => t.audioUrl);
}

// 1. playList: antrean, indeks, src, dan status
fresh();
await P().playList(tracks, 1);
await tick();
assert.equal(P().index, 1);
assert.equal(P().queue.length, 3);
assert.equal(audio().src, "https://x/2.mp3");
assert.equal(P().status, "playing");
assert.equal(useProgress.getState().duration, 102);
pass("playList mengisi antrean, memulai dari indeks yang diklik, dan status playing");

// 2. lagu selesai: otomatis lanjut
audio().end();
await tick();
assert.equal(P().index, 2);
assert.equal(audio().src, "https://x/3.mp3");
assert.equal(P().status, "playing");
pass("ended memutar lagu berikutnya otomatis");

// 3. lagu terakhir selesai: berhenti, kembali ke awal, tanpa galat
audio().currentTime = 50;
audio().end();
await tick();
assert.equal(P().status, "paused");
assert.equal(audio().currentTime, 0);
assert.equal(P().index, 2);
assert.equal(P().notice, null);
pass("setelah lagu terakhir: berhenti, kembali ke awal lagu terakhir, tanpa notifikasi galat");

// 4. prev: >3 detik kembali ke awal lagu; <=3 detik ke lagu sebelumnya
fresh();
await P().playList(tracks, 2);
await tick();
audio().currentTime = 10;
await P().prev();
assert.equal(P().index, 2);
assert.equal(audio().currentTime, 0);
await P().prev();
await tick();
assert.equal(P().index, 1);
await P().prev();
await P().prev();
await tick();
assert.equal(P().index, 0, "prev tidak boleh lebih kecil dari 0");
pass('"Sebelumnya": >3 dtk ke awal lagu, selain itu lagu sebelumnya, berhenti di indeks 0');

// 5. "Berikutnya" cepat berulang: hanya permintaan terakhir yang diputar (tidak ada audio ganda)
fresh();
setUrlResolver(async (t) => {
  await tick(t.id === "t2" ? 40 : 5);
  return t.audioUrl;
});
await P().playList(tracks, 0);
await tick(20);
audio().played = [];
const a = P().next();
const b = P().next(); // dua klik cepat
await Promise.all([a, b]);
await tick(60);
assert.equal(audio().src, "https://x/3.mp3");
assert.deepEqual(audio().played, ["https://x/3.mp3"], `hanya satu lagu diputar, dapat: ${JSON.stringify(audio().played)}`);
pass('klik "Berikutnya" dua kali cepat: hanya lagu terakhir yang diputar (hasil usang dibuang)');

// 6. galat file: notifikasi dan lompat ke lagu berikutnya
fresh();
await P().playList(tracks, 0);
await tick();
audio().fail();
await tick();
assert.equal(P().index, 1);
assert.equal(P().notice?.kind, "error");
assert.match(P().notice?.message ?? "", /Lagu 1/);
pass("galat memuat: notifikasi + lompat ke lagu berikutnya");

// 7. URL tidak ada: dilewati; semua rusak: berhenti tanpa menggantung
fresh();
const broken: Track[] = tracks.map((t) => ({ ...t, audioUrl: null }));
await P().playList(broken, 0);
await tick(20);
assert.equal(P().status, "paused");
assert.equal(P().index, 2);
pass("semua lagu tanpa URL: dilewati satu per satu lalu berhenti (tidak menggantung)");

// 8. autoplay ditolak: jeda tanpa galat dan tanpa lompat
fresh();
audio().mode = "notallowed";
await P().playList(tracks, 0);
await tick();
assert.equal(P().status, "paused");
assert.equal(P().index, 0);
assert.equal(P().notice, null);
pass("play() ditolak (autoplay): kembali ke jeda, tanpa galat, tanpa melompat");

// 9. toggle, seek, volume
fresh();
await P().playList(tracks, 0);
await tick();
P().toggle();
await tick();
assert.equal(audio().paused, true);
assert.equal(P().status, "paused");
P().toggle();
await tick();
assert.equal(audio().paused, false);
assert.equal(P().status, "playing");
P().seek(42);
assert.equal(audio().currentTime, 42);
assert.equal(useProgress.getState().position, 42);
P().setVolume(60);
assert.equal(audio().volume, 0.6);
assert.equal(P().volume, 60);
P().setVolume(500);
assert.equal(P().volume, 100);
pass("toggle jeda/putar, seek, dan volume (dibatasi 0-100)");

// 10. enqueue tidak mengganggu pemutaran; reset mengosongkan
fresh();
await P().playList(tracks.slice(0, 2), 0);
await tick();
P().enqueue(tracks[2]);
assert.equal(P().queue.length, 3);
assert.equal(P().index, 0);
assert.equal(audio().src, "https://x/1.mp3");
P().reset();
assert.deepEqual([P().queue.length, P().index, P().status, audio().src], [0, -1, "idle", ""]);
audio().fail(); // galat setelah reset tidak boleh memicu notifikasi
await tick();
assert.equal(P().notice, null);
pass("enqueue menambah antrean tanpa mengganggu lagu aktif; reset mengosongkan dan menghentikan audio");

// 11. hanya satu elemen audio
assert.equal(getAudio(), getAudio());
assert.equal((globalThis as unknown as { __streamingAudio: unknown }).__streamingAudio, getAudio());
pass("getAudio() selalu mengembalikan satu elemen yang sama (singleton di globalThis)");
console.log("SEMUA LULUS");
