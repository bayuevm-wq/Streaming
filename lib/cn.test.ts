// Uji cn(): kelas yang bertabrakan harus diselesaikan (yang terakhir menang), dan semua token kustom di globals.css
// harus terdaftar agar tidak dianggap bertabrakan dengan kelas lain. Jalankan: node lib/cn.test.ts
import assert from "node:assert/strict";
import fs from "node:fs";
import { cn } from "./cn.ts";

const eq = (actual: string, expected: string, name: string) => {
  assert.equal(actual, expected, `${name}: dapat "${actual}", diharapkan "${expected}"`);
  console.log(`PASS ${name}`);
};

// --- bug yang dilaporkan --------------------------------------------------------------------------
{
  const merged = cn("relative aspect-square w-full overflow-hidden bg-raised text-muted", "size-10");
  assert.ok(!/\bw-full\b/.test(merged) && /\bsize-10\b/.test(merged), `Cover + size-10: "${merged}"`);
  console.log("PASS w-full bawaan Cover kalah dari size-10 (strip melebar tidak terjadi lagi)");
}
eq(cn("bg-raised", "bg-surface"), "bg-surface", "bg-raised + bg-surface => yang terakhir");

// --- token kustom: konflik sesama kelompok, bukan lintas kelompok ------------------------------------
eq(cn("text-small", "text-heading"), "text-heading", "dua ukuran huruf kustom bertabrakan");
eq(cn("text-small", "text-ink"), "text-small text-ink", "ukuran huruf + warna teks kustom tidak bertabrakan");
eq(cn("text-muted", "text-accent"), "text-accent", "dua warna teks kustom bertabrakan");
eq(cn("font-display", "font-body"), "font-body", "dua font kustom bertabrakan");
eq(cn("font-display", "font-semibold"), "font-display font-semibold", "font kustom + bobot tidak bertabrakan");
eq(cn("shadow-float", "shadow-none"), "shadow-none", "shadow-float bertabrakan dengan shadow-none");
eq(cn("border", "border-hairline", "border-control"), "border border-control", "warna batas kustom: yang terakhir menang");
eq(cn("border-t-2", "border-success"), "border-t-2 border-success", "lebar batas + warna batas tidak bertabrakan");

// --- varian ----------------------------------------------------------------------------------------
eq(cn("size-11", "phone:size-10"), "size-11 phone:size-10", "varian phone: tidak menimpa dasar");
eq(cn("phone:text-numeral-sm", "phone:text-title"), "phone:text-title", "dalam varian yang sama, yang terakhir menang");
eq(cn("hover:bg-accent-hover", "hover:bg-raised"), "hover:bg-raised", "varian hover: yang terakhir menang");

// --- padding: p-* lalu pr-* tetap keduanya (Toast: p-3 + pr-12) ------------------------------------------
eq(cn("p-3", "pr-12"), "p-3 pr-12", "p-3 lalu pr-12 dipertahankan");
eq(cn("pr-12", "p-3"), "p-3", "p-3 setelah pr-12 menggantikannya");

// --- nilai falsy -----------------------------------------------------------------------------------
eq(cn("bg-accent", false, null, undefined, "", "text-ink"), "bg-accent text-ink", "nilai falsy dibuang");

// --- sinkron dengan globals.css: setiap token terdaftar ------------------------------------------------
const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const colors = [...css.matchAll(/--color-([a-z-]+):/g)].map((m) => m[1]);
const sizes = [...css.matchAll(/--text-([a-z-]+):\s*[\d.]+rem;/g)].map((m) => m[1]);
assert.ok(colors.length >= 17 && sizes.length >= 10, "token tidak terbaca dari globals.css");
for (const c of colors) {
  if (c === "scrim") continue; // dipakai sebagai bg-scrim saja
  assert.equal(cn("bg-ground", `bg-${c}`), `bg-${c}`, `warna kustom "${c}" belum terdaftar di cn()`);
  assert.equal(cn("text-small", `text-${c}`), `text-small text-${c}`, `warna "${c}" tidak boleh bertabrakan dengan ukuran huruf`);
}
for (const s of sizes) assert.equal(cn("text-ink", `text-${s}`), `text-ink text-${s}`, `ukuran "${s}" belum terdaftar di cn()`);
assert.equal(cn("bg-ground", "bg-scrim"), "bg-scrim", "bg-scrim belum terdaftar");
console.log(`PASS semua ${colors.length} token warna dan ${sizes.length} token ukuran huruf di globals.css terdaftar di cn()`);
console.log("SEMUA LULUS");
