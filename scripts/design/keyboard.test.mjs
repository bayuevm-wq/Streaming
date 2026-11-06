// Uji keyboard dan tampilan kontrol pada /gaya, memakai Chrome sungguhan lewat DevTools Protocol (tanpa dependensi).
//   BASE_URL=http://127.0.0.1:3000 node scripts/design/keyboard.test.mjs
// Membuktikan: slider progres/volume bisa difokus dengan Tab, digeser dengan panah/Home/End, aria-valuetext benar,
// cincin fokus kobalt terlihat (2px, offset 3px), sudut tajam, dan nomor lagu mengecil di <= 640px.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const candidates = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);
const chromePath = candidates.find((p) => fs.existsSync(p));
if (!chromePath) throw new Error("Chrome/Chromium tidak ditemukan; atur CHROME_PATH");

const port = 9400 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "kbd-"));
const chrome = spawn(chromePath, ["--headless=new", "--disable-gpu", "--no-sandbox", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (n) => console.log(`PASS ${n}`);

let targets;
for (let i = 0; i < 60 && !targets?.length; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(250); }
}
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let nextId = 0;
const waiting = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } };
const cdp = (method, params = {}) => new Promise((res) => { const id = ++nextId; waiting.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evalJs = async (expr) => (await cdp("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result.result.value;
const press = async (key, code = key, vk = 0) => {
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
};
const KEYS = { Tab: ["Tab", "Tab", 9], ArrowRight: ["ArrowRight", "ArrowRight", 39], ArrowLeft: ["ArrowLeft", "ArrowLeft", 37], Home: ["Home", "Home", 36], End: ["End", "End", 35] };
const key = (k) => press(...KEYS[k]);
const slider = (label) => `document.querySelector('input[type=range][aria-label="${label}"]')`;
const state = (label) => evalJs(`(()=>{const e=${slider(label)};return {v:e.value,t:e.getAttribute('aria-valuetext'),n:e.getAttribute('aria-label')}})()`);

async function open(width) {
  await cdp("Page.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url: `${BASE}/gaya` });
  await sleep(3500);
  await evalJs("document.fonts.ready.then(()=>1)");
}

try {
  await open(1280);

  // --- Tab sampai slider posisi mendapat fokus --------------------------------------------------------
  let focused = false;
  for (let i = 0; i < 400 && !focused; i++) {
    await key("Tab");
    focused = await evalJs(`document.activeElement === ${slider("Posisi lagu")}`);
  }
  assert.ok(focused, "slider posisi tidak dapat dijangkau dengan Tab");
  pass("Tab menjangkau slider posisi lagu");

  // --- fokus terlihat: cincin kobalt 2px, offset 3px pada pembungkus slider --------------------------
  const ring = await evalJs(`(()=>{const a=document.activeElement;const s=getComputedStyle(a.parentElement);return {style:s.outlineStyle,w:s.outlineWidth,off:s.outlineOffset,c:s.outlineColor,fv:a.matches(':focus-visible'),has:a.parentElement.matches(':has(> input:focus-visible)'),cls:a.parentElement.className}})()`);
  assert.deepEqual(ring, { style: "solid", w: "2px", off: "3px", c: "rgb(124, 151, 255)", fv: true, has: true, cls: ring.cls });
  pass(`fokus slider terlihat: outline ${ring.w} ${ring.style} ${ring.c}, offset ${ring.off}`);

  // --- panah, Home, End, dan aria-valuetext -----------------------------------------------------------
  assert.deepEqual(await state("Posisi lagu"), { v: "84", t: "1:24 dari 3:42", n: "Posisi lagu" });
  for (let i = 0; i < 3; i++) await key("ArrowRight");
  assert.deepEqual(await state("Posisi lagu"), { v: "87", t: "1:27 dari 3:42", n: "Posisi lagu" });
  await key("ArrowLeft");
  assert.equal((await state("Posisi lagu")).v, "86");
  await key("Home");
  assert.deepEqual(await state("Posisi lagu"), { v: "0", t: "0:00 dari 3:42", n: "Posisi lagu" });
  await key("End");
  assert.deepEqual(await state("Posisi lagu"), { v: "222", t: "3:42 dari 3:42", n: "Posisi lagu" });
  pass('slider posisi: panah ±1 dtk, Home/End, aria-valuetext "1:27 dari 3:42" dst.');

  // --- slider volume dijangkau dengan Tab berikutnya dan bisa digeser --------------------------------
  let vol = false;
  for (let i = 0; i < 6 && !vol; i++) {
    await key("Tab");
    vol = await evalJs(`document.activeElement === ${slider("Volume")}`);
  }
  assert.ok(vol, "slider volume tidak dapat dijangkau dengan Tab");
  await key("ArrowLeft");
  assert.deepEqual(await state("Volume"), { v: "60", t: "60%", n: "Volume" });
  pass('slider volume: Tab, panah kiri => 60%, aria-valuetext "60%"');

  // --- fokus pada tombol memakai aturan global yang sama ---------------------------------------------
  const btn = await evalJs(`(()=>{document.querySelector('#tombol button:not([disabled])').focus();const b=document.activeElement;const s=getComputedStyle(b);return {style:s.outlineStyle,w:s.outlineWidth,off:s.outlineOffset,c:s.outlineColor,r:s.borderTopLeftRadius}})()`);
  assert.deepEqual({ ...btn, r: undefined }, { style: "solid", w: "2px", off: "3px", c: "rgb(124, 151, 255)", r: undefined });
  pass("fokus tombol: outline kobalt 2px, offset 3px");

  // --- cn(): <Cover className="size-10"> di footer harus 40x40, bukan melebar menjadi strip -----------------
  const foot = await evalJs(`(()=>{const r=document.querySelector('footer .aspect-square').getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height)}})()`);
  assert.deepEqual(foot, { w: 40, h: 40 });
  pass("Cover className=size-10 di footer berukuran 40x40 (w-full bawaan tidak menang)");

  // --- waktu: angka tabular, titik dua proporsional (tidak tampak "3 : 42") ---------------------------------
  const widths = await evalJs(`(()=>{const w=(s)=>{const e=document.createElement('span');e.className='tabular-nums';e.style.cssText='position:absolute;visibility:hidden;font-size:14px;white-space:pre';e.innerHTML=s;document.body.append(e);const x=e.getBoundingClientRect().width;e.remove();return x};
    const colon='<span class="colon">:</span>';
    return {plain:w('3:42'),hybrid:w('3'+colon+'42'),h1:w('1'+colon+'24'),h2:w('0'+colon+'08'),h3:w('3'+colon+'42')}})()`);
  assert.ok(widths.hybrid < widths.plain - 4, `titik dua proporsional harus menghemat > 4px: ${JSON.stringify(widths)}`);
  assert.ok(Math.abs(widths.h1 - widths.h2) < 0.1 && Math.abs(widths.h2 - widths.h3) < 0.1, `lebar "d:dd" harus sama (kolom rata): ${JSON.stringify(widths)}`);
  pass(`waktu: "3:42" ${widths.plain.toFixed(1)}px (tabular penuh) -> ${widths.hybrid.toFixed(1)}px; semua "d:dd" selebar sama`);

  // --- sudut tajam: kartu, sampul, tombol, input, dialog ---------------------------------------------
  const radii = await evalJs(`[...document.querySelectorAll('article, button, input, dialog, svg.size-full, .aspect-square')].map(e=>getComputedStyle(e).borderTopLeftRadius).filter(r=>r!=='0px').length`);
  assert.equal(radii, 0, "ada elemen dengan sudut membulat");
  pass("sudut tajam: tidak ada elemen kartu/sampul/tombol/input/dialog yang membulat");

  // --- nomor lagu mengecil di <= 640px ---------------------------------------------------------------
  const numSize = () => evalJs(`getComputedStyle(document.querySelector('#media div.group > div:has(> button[aria-label^="Putar Kota"]) > span[aria-hidden]')).fontSize`);
  assert.equal(await numSize(), "30px");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 640, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(600);
  const vp = await evalJs(`({w:innerWidth,cw:document.documentElement.clientWidth,mq:matchMedia('(max-width: 640px)').matches})`);
  assert.equal(await numSize(), "20px", `viewport: ${JSON.stringify(vp)}`);
  const albumHidden = await evalJs(`getComputedStyle([...document.querySelectorAll('#media p')].find(p=>p.textContent==='Setengah Sadar')).display`);
  assert.equal(albumHidden, "none");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 641, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(300);
  assert.equal(await numSize(), "30px");
  pass("nomor lagu 30px di 641px dan 20px di 640px; kolom album tersembunyi di <= 640px");

  console.log("SEMUA LULUS");
} finally {
  ws.close();
  chrome.kill();
}
process.exit(0);
