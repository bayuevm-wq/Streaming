import assert from 'node:assert/strict';
import { checkMp3, checkImage, LIMITS } from './mp3.ts';

// MPEG1 Layer III, 128 kbps, 44.1 kHz, stereo => header FF FB 90 00, panjang frame 417 byte
const FRAME = 417;
function mp3(frames: number, opts: { id3?: number; xing?: number; junk?: number } = {}): Uint8Array {
  const parts: number[] = [];
  if (opts.id3 !== undefined) {
    const n = opts.id3;
    parts.push(0x49, 0x44, 0x33, 3, 0, 0, (n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f);
    for (let i = 0; i < n; i++) parts.push(0);
  }
  for (let i = 0; i < (opts.junk ?? 0); i++) parts.push(0x41);
  const out = new Uint8Array(parts.length + frames * FRAME);
  out.set(parts, 0);
  for (let f = 0; f < frames; f++) out.set([0xff, 0xfb, 0x90, 0x00], parts.length + f * FRAME);
  if (opts.xing) {
    const t = parts.length + 4 + 32;
    out.set([0x58, 0x69, 0x6e, 0x67, 0, 0, 0, 1], t);
    out.set([(opts.xing >>> 24) & 255, (opts.xing >>> 16) & 255, (opts.xing >>> 8) & 255, opts.xing & 255], t + 8);
  }
  return out;
}
const head = (b: Uint8Array) => b.subarray(0, LIMITS.headBytes);

// 1. MP3 CBR valid: 128 kbps => 16000 byte/dtk; 400 frame * 417 = 166800 byte => ~10.4 dtk
let f = mp3(400);
let r = checkMp3(head(f), f.length);
assert.equal(r.ok, true);
if (r.ok) { assert.equal(r.bitrateKbps, 128); assert.equal(r.sampleRate, 44100); assert.equal(r.durationSec, 10); }

// 2. dengan tag ID3v2 kecil dan sampah di depan frame
f = mp3(400, { id3: 2000, junk: 37 });
r = checkMp3(head(f), f.length);
assert.equal(r.ok, true);

// 3. header Xing: 1000 frame * 1152 / 44100 = 26.12 dtk
f = mp3(400, { xing: 1000 });
r = checkMp3(head(f), f.length);
assert.equal(r.ok && r.durationSec, 26);

// 4. tag ID3 besar (200 KB) melewati head 64 KB => minta jendela kedua, lalu valid
f = mp3(400, { id3: 200_000 });
r = checkMp3(head(f), f.length);
assert.deepEqual(r, { ok: false, reason: 'need_window', needFrom: 200_010 });
r = checkMp3(head(f), f.length, { offset: 200_010, bytes: f.subarray(200_010, 200_010 + LIMITS.windowBytes) });
assert.equal(r.ok, true);

// 5. tag ID3 > 4 MB ditolak
f = mp3(10, { id3: 0 }); f[6] = 0x7f; f[7] = 0x7f;
assert.deepEqual(checkMp3(head(f), 5_000_000), { ok: false, reason: 'tag_too_large' });

// 6. ditolak: WAV, byte acak, Layer II, MP3 terpotong, terlalu kecil/besar
const wav = new Uint8Array(100_000); wav.set([0x52, 0x49, 0x46, 0x46]); wav.set([0x57, 0x41, 0x56, 0x45], 8);
assert.deepEqual(checkMp3(head(wav), wav.length), { ok: false, reason: 'not_mp3' });
const rnd = new Uint8Array(100_000).map((_, i) => (i * 2654435761) >>> 24);
assert.equal(checkMp3(head(rnd), rnd.length).ok, false);
const layer2 = mp3(400); for (let i = 0; i < 400; i++) layer2[i * FRAME + 1] = 0xfd; // layer II
assert.equal(checkMp3(head(layer2), layer2.length).ok, false);
const single = mp3(1); // 1 frame saja bukan bukti cukup (butuh 3 beruntun) dan < minBytes
assert.equal(checkMp3(single, single.length).ok, false);
assert.deepEqual(checkMp3(head(mp3(400)), LIMITS.maxBytes + 1), { ok: false, reason: 'too_large' });
// satu frame valid di tengah sampah (mis. "MZ" + FF FB di tengah file .exe) tidak lolos
const fake = new Uint8Array(100_000).fill(0x90); fake.set([0xff, 0xfb, 0x90, 0x00], 5000);
assert.equal(checkMp3(head(fake), fake.length).ok, false);

// 7. gambar
assert.equal(checkImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]), 'jpg'), true);
assert.equal(checkImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]), 'png'), true);
assert.equal(checkImage(Uint8Array.from([0x4d, 0x5a, 0x90, 0, 0, 0]), 'jpg'), false);
console.log('semua uji mp3.ts lulus');
