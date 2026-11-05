// lib/audio/mp3.ts — fungsi murni (tanpa I/O): dipakai Route Handler finalize, skrip seed, dan unit test.
// Hanya menerima MPEG Layer III (MP3 sungguhan). Layer I/II, WAV, AAC, dan file acak ditolak.

export const LIMITS = {
  maxBytes: 10 * 1024 * 1024, // batas pengunjung
  minBytes: 4 * 1024,
  maxId3Bytes: 4 * 1024 * 1024,
  headBytes: 64 * 1024, // yang dibaca dari awal file lewat HTTP Range
  windowBytes: 32 * 1024, // jendela kedua bila tag ID3 melewati headBytes
  scanBytes: 16 * 1024, // ruang minimum di depan untuk mencari 3 frame beruntun
} as const;

const BITRATE_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, -1];
const BITRATE_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, -1];
const SAMPLE_RATE: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

export type Frame = { len: number; bitrateKbps: number; sampleRate: number; samplesPerFrame: number };

/** Header frame 4 byte di offset o, atau null bila bukan header MP3 Layer III yang valid. */
export function parseFrameHeader(b: Uint8Array, o: number): Frame | null {
  if (o < 0 || o + 4 > b.length) return null;
  if (b[o] !== 0xff || (b[o + 1] & 0xe0) !== 0xe0) return null; // 11 bit sinkron
  const version = (b[o + 1] >> 3) & 3; // 3=MPEG1, 2=MPEG2, 0=MPEG2.5, 1=cadangan
  const layer = (b[o + 1] >> 1) & 3; // 1 = Layer III
  const brIdx = (b[o + 2] >> 4) & 15;
  const srIdx = (b[o + 2] >> 2) & 3;
  const pad = (b[o + 2] >> 1) & 1;
  if (version === 1 || layer !== 1 || srIdx === 3) return null;
  const bitrateKbps = (version === 3 ? BITRATE_V1_L3 : BITRATE_V2_L3)[brIdx];
  if (bitrateKbps <= 0) return null; // 0 = "free format", -1 = tidak valid: ditolak
  const sampleRate = SAMPLE_RATE[version][srIdx];
  const samplesPerFrame = version === 3 ? 1152 : 576;
  const len = Math.floor(((samplesPerFrame / 8) * bitrateKbps * 1000) / sampleRate) + pad;
  return { len, bitrateKbps, sampleRate, samplesPerFrame };
}

/** Total byte tag ID3v2 di awal file yang harus dilewati (0 bila tidak ada). */
export function id3v2Size(b: Uint8Array): number {
  if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return 0; // "ID3"
  const size = ((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f);
  return 10 + size + (b[5] & 0x10 ? 10 : 0);
}

/** Cari posisi pertama yang diikuti `needed` frame valid BERUNTUN (menghindari salah deteksi byte acak). */
export function findFirstFrames(b: Uint8Array, from: number, scanLimit = 8192, needed = 3): { offset: number; frame: Frame } | null {
  const end = Math.min(from + scanLimit, b.length - 4);
  for (let s = Math.max(from, 0); s < end; s++) {
    let o = s;
    let first: Frame | null = null;
    let n = 0;
    while (n < needed) {
      const f = parseFrameHeader(b, o);
      if (!f) break;
      first ??= f;
      n++;
      o += f.len;
    }
    if (n === needed && first) return { offset: s, frame: first };
  }
  return null;
}

/** Jumlah frame dari header Xing/Info (VBR/CBR modern), atau null. */
export function xingFrames(b: Uint8Array, o: number, f: Frame): number | null {
  const mono = ((b[o + 3] >> 6) & 3) === 3;
  const mpeg1 = f.samplesPerFrame === 1152;
  const side = mpeg1 ? (mono ? 17 : 32) : mono ? 9 : 17;
  const t = o + 4 + side;
  if (t + 12 > b.length) return null;
  const tag = String.fromCharCode(b[t], b[t + 1], b[t + 2], b[t + 3]);
  if ((tag !== 'Xing' && tag !== 'Info') || !(b[t + 7] & 1)) return null;
  return ((b[t + 8] << 24) | (b[t + 9] << 16) | (b[t + 10] << 8) | b[t + 11]) >>> 0;
}

export type Mp3Verdict =
  | { ok: true; durationSec: number; bitrateKbps: number; sampleRate: number }
  | { ok: false; reason: 'too_small' | 'too_large' | 'not_mp3' | 'tag_too_large' }
  | { ok: false; reason: 'need_window'; needFrom: number };

/**
 * head  : byte 0..headBytes-1 file.
 * total : ukuran file sebenarnya (dari Content-Range / Content-Length, BUKAN dari klien).
 * win   : bila hasil sebelumnya 'need_window', ambil LIMITS.windowBytes byte mulai needFrom lalu panggil ulang.
 */
export function checkMp3(head: Uint8Array, total: number, win?: { offset: number; bytes: Uint8Array }): Mp3Verdict {
  if (total > LIMITS.maxBytes) return { ok: false, reason: 'too_large' };
  if (total < LIMITS.minBytes) return { ok: false, reason: 'too_small' };
  const skip = id3v2Size(head);
  if (skip > LIMITS.maxId3Bytes) return { ok: false, reason: 'tag_too_large' };

  let bytes = head;
  let base = 0;
  const headCoversIt = skip + LIMITS.scanBytes <= head.length || head.length >= total;
  if (!headCoversIt) {
    if (!win || win.offset !== skip) return { ok: false, reason: 'need_window', needFrom: skip };
    bytes = win.bytes;
    base = win.offset;
  }
  const hit = findFirstFrames(bytes, skip - base);
  if (!hit) return { ok: false, reason: 'not_mp3' };

  const { frame } = hit;
  const xing = xingFrames(bytes, hit.offset, frame);
  const audioBytes = total - (base + hit.offset);
  const seconds = xing ? (xing * frame.samplesPerFrame) / frame.sampleRate : (audioBytes * 8) / (frame.bitrateKbps * 1000);
  return { ok: true, durationSec: Math.max(1, Math.round(seconds)), bitrateKbps: frame.bitrateKbps, sampleRate: frame.sampleRate };
}

/** Magic bytes cover: JPEG / PNG / WebP. */
export function checkImage(b: Uint8Array, ext: 'jpg' | 'png' | 'webp'): boolean {
  if (ext === 'jpg') return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (ext === 'png') return b.length > 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v);
  const s = (o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  return b.length > 12 && s(0) === 'RIFF' && s(8) === 'WEBP';
}
