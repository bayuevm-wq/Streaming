// Membuat sampul seed SENDIRI (bukan dari situs sumber) untuk 4 album dan 4 artis: 640x640 JPG, abstrak, tanpa teks.
// Gaya "Tinta Cetak" (docs/design-system.md): dasar gelap, tinta kertas hangat, satu tinta kobalt, tumpang-tindih bergeser
// seperti cetak dua warna. Deterministik (PRNG berbiji), jadi menjalankan ulang menghasilkan gambar yang sama.
//
//   node scripts/seed/make-covers.mjs        -> scripts/seed/covers/*.jpg (tidak masuk git)
import fs from "node:fs";
import { chromium } from "@playwright/test";

const SIZE = 640;
const G = "#13151a"; // ground
const S = "#1a1d24"; // surface
const R = "#232731"; // raised
const I = "#ece9e2"; // ink (kertas)
const A = "#7c97ff"; // accent (kobalt)
const H = "#4a5266"; // hairline

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n) => Number(n.toFixed(1));
const svg = (body, bg = G) => `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}"><rect width="${SIZE}" height="${SIZE}" fill="${bg}"/>${body}</svg>`;

/** Deretan tanda penggaris (motif slider "penggaris" pada pemutar) di sepanjang satu sisi bawah. */
function ruler(y, color = H, step = 16, long = 4) {
  let s = "";
  for (let i = 0, x = 32; x <= SIZE - 32; i++, x += step) s += `<rect x="${x}" y="${y}" width="2" height="${i % long === 0 ? 22 : 11}" fill="${color}"/>`;
  return s;
}

// ---------------- ALBUM ----------------
function winterLofi() {
  // medan titik halftone (menebal ke kanan-bawah) + satu lingkaran kobalt bergeser
  const r = rng(101);
  let dots = "";
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      const t = (x + y) / 38;
      const rad = 2 + t * 11 + (r() - 0.5) * 1.2;
      dots += `<circle cx="${f(32 + x * 30.4)}" cy="${f(32 + y * 30.4)}" r="${f(rad)}" fill="${I}" opacity="${f(0.15 + t * 0.55)}"/>`;
    }
  }
  return svg(`${dots}<circle cx="232" cy="236" r="150" fill="${A}" style="mix-blend-mode:screen" opacity="0.9"/><circle cx="244" cy="248" r="150" fill="none" stroke="${I}" stroke-width="3"/>${ruler(590)}`);
}
function ultraPerson() {
  // grid modular 8x8 ala blok permainan: isi acak ink / kobalt / kosong, ditambah balok diagonal tebal
  const r = rng(202);
  const n = 8;
  const cell = 64;
  const off = (SIZE - n * cell) / 2;
  let b = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = r();
      const fill = v < 0.18 ? A : v < 0.42 ? I : v < 0.55 ? R : null;
      if (fill) b += `<rect x="${off + x * cell + 4}" y="${off + y * cell + 4}" width="${cell - 8}" height="${cell - 8}" fill="${fill}"/>`;
      else b += `<rect x="${off + x * cell + 4}" y="${off + y * cell + 4}" width="${cell - 8}" height="${cell - 8}" fill="none" stroke="${H}" stroke-width="2"/>`;
    }
  }
  return svg(`${b}<polygon points="0,420 640,120 640,200 0,500" fill="${A}" opacity="0.88" style="mix-blend-mode:screen"/>`);
}
function freeForYou() {
  // cincin konsentris dengan pusat bergeser (kobalt dan ink) seperti riak dari dua sumber
  let b = "";
  for (let i = 1; i <= 14; i++) b += `<circle cx="280" cy="300" r="${i * 24}" fill="none" stroke="${A}" stroke-width="${i % 3 === 0 ? 5 : 2}" opacity="${f(0.95 - i * 0.04)}"/>`;
  for (let i = 1; i <= 11; i++) b += `<circle cx="372" cy="352" r="${i * 24}" fill="none" stroke="${I}" stroke-width="${i % 4 === 0 ? 4 : 1.5}" opacity="${f(0.8 - i * 0.05)}"/>`;
  return svg(`${b}<circle cx="326" cy="326" r="14" fill="${I}"/>`);
}
function incompetechSelection() {
  // batang horizontal bertumpuk berbagai panjang (rak katalog) dengan penggaris di kiri
  const r = rng(404);
  let b = "";
  for (let i = 0; i < 18; i++) {
    const y = 40 + i * 31;
    const len = 120 + Math.floor(r() * 420);
    const accent = i === 6 || i === 13;
    b += `<rect x="96" y="${y}" width="${len}" height="20" fill="${accent ? A : I}" opacity="${accent ? 1 : f(0.35 + r() * 0.5)}"/>`;
    b += `<rect x="${96 + len + 10}" y="${y + 8}" width="${Math.floor(r() * 40) + 6}" height="4" fill="${H}"/>`;
  }
  let tick = "";
  for (let y = 40; y < 600; y += 14) tick += `<rect x="${y % 56 === 40 % 56 ? 40 : 56}" y="${y}" width="${y % 56 === 40 % 56 ? 40 : 24}" height="2" fill="${H}"/>`;
  return svg(`${tick}${b}`, S);
}

// ---------------- ARTIS ----------------
function holiznaArtist() {
  // bukit setengah lingkaran berlapis (ink dan kobalt) dari bawah ke atas
  let b = "";
  const layers = [
    [320, 640, 300, R, 1],
    [210, 560, 250, I, 0.85],
    [440, 520, 210, A, 0.95],
    [160, 470, 160, I, 0.5],
    [520, 430, 120, R, 1],
    [330, 400, 90, A, 0.9],
  ];
  for (const [cx, cy, rad, c, o] of layers) b += `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${c}" opacity="${o}"/>`;
  return svg(`${b}${ruler(40, H, 20, 5)}`);
}
function komikuArtist() {
  // garis diagonal rapat dipotong lingkaran kobalt
  let lines = "";
  for (let i = -20; i < 40; i++) lines += `<line x1="${i * 24}" y1="0" x2="${i * 24 + 640}" y2="640" stroke="${i % 5 === 0 ? I : H}" stroke-width="${i % 5 === 0 ? 4 : 2}"/>`;
  return svg(`${lines}<circle cx="320" cy="320" r="170" fill="${G}"/><circle cx="320" cy="320" r="170" fill="none" stroke="${A}" stroke-width="10"/><circle cx="320" cy="320" r="92" fill="${A}"/>`);
}
function loboLocoArtist() {
  // gelombang sinus bertumpuk; satu garis kobalt tebal sebagai sorotan
  let b = "";
  for (let i = 0; i < 16; i++) {
    const y = 60 + i * 34;
    const amp = 10 + (i % 5) * 7;
    const ph = i * 0.55;
    let d = `M 0 ${y}`;
    for (let x = 0; x <= SIZE; x += 8) d += ` L ${x} ${f(y + Math.sin(x / 52 + ph) * amp)}`;
    const hi = i === 9;
    b += `<path d="${d}" fill="none" stroke="${hi ? A : I}" stroke-width="${hi ? 9 : 2.5}" opacity="${hi ? 1 : f(0.25 + (i % 4) * 0.15)}"/>`;
  }
  return svg(b, S);
}
function kevinArtist() {
  // lajur vertikal berbagai tinggi (seperti penyeimbang audio) mengelilingi satu cincin kobalt
  const r = rng(808);
  let b = "";
  for (let i = 0; i < 28; i++) {
    const h = 80 + Math.floor(r() * 400);
    const x = 40 + i * 21.2;
    b += `<rect x="${f(x)}" y="${f(320 - h / 2)}" width="12" height="${h}" fill="${I}" opacity="${f(0.3 + r() * 0.55)}"/>`;
  }
  return svg(`${b}<circle cx="320" cy="320" r="150" fill="${G}" opacity="0.92"/><circle cx="320" cy="320" r="150" fill="none" stroke="${A}" stroke-width="12"/><circle cx="320" cy="320" r="40" fill="${A}"/>`);
}

const FILES = {
  "album-winter-lofi": winterLofi,
  "album-ultra-person-vol4": ultraPerson,
  "album-free-for-you": freeForYou,
  "album-incompetech-selection": incompetechSelection,
  "artist-holiznacc0": holiznaArtist,
  "artist-komiku": komikuArtist,
  "artist-lobo-loco": loboLocoArtist,
  "artist-kevin-macleod": kevinArtist,
};

fs.mkdirSync("scripts/seed/covers", { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
for (const [name, make] of Object.entries(FILES)) {
  await page.setContent(`<!doctype html><body style="margin:0;background:${G}">${make()}</body>`);
  const out = `scripts/seed/covers/${name}.jpg`;
  await page.screenshot({ path: out, type: "jpeg", quality: 90, clip: { x: 0, y: 0, width: SIZE, height: SIZE } });
  console.log(`${out} ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
}
await browser.close();
