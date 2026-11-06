import assert from "node:assert/strict";
import { __setClock, cachedPrivateUrl, clearPrivateUrls, prefetchPrivateUrl, setSigner } from "./private-url.ts";

const t = async (name: string, fn: () => Promise<void>) => {
  clearPrivateUrls();
  setSigner(null);
  let clock = 0;
  __setClock(() => clock);
  (globalThis as { __advance?: (ms: number) => void }).__advance = (ms) => (clock += ms);
  await fn();
  console.log(`PASS ${name}`);
};
const advance = (ms: number) => (globalThis as unknown as { __advance: (ms: number) => void }).__advance(ms);

await t("belum di-cache: cachedPrivateUrl null (jalur lambat dipakai)", async () => {
  assert.equal(cachedPrivateUrl("a"), null);
});

await t("prefetch mengisi cache; setelahnya pembacaan SINKRON (tanpa await)", async () => {
  setSigner(async (id) => `https://x/${id}?token=1`);
  assert.equal(cachedPrivateUrl("a"), null);
  await prefetchPrivateUrl("a");
  assert.equal(cachedPrivateUrl("a"), "https://x/a?token=1");
});

await t("permintaan bersamaan untuk lagu yang sama = satu panggilan penandatangan", async () => {
  let calls = 0;
  setSigner(async (id) => {
    calls++;
    await new Promise((r) => setTimeout(r, 5));
    return `u-${id}`;
  });
  const [x, y, z] = await Promise.all([prefetchPrivateUrl("a"), prefetchPrivateUrl("a"), prefetchPrivateUrl("a")]);
  assert.deepEqual([x, y, z], ["u-a", "u-a", "u-a"]);
  assert.equal(calls, 1);
  await prefetchPrivateUrl("a"); // sudah di-cache
  assert.equal(calls, 1);
});

await t("kedaluwarsa setelah 50 menit: cache dibuang dan diambil ulang", async () => {
  let n = 0;
  setSigner(async () => `u${++n}`);
  await prefetchPrivateUrl("a");
  advance(49 * 60 * 1000);
  assert.equal(cachedPrivateUrl("a"), "u1");
  advance(2 * 60 * 1000);
  assert.equal(cachedPrivateUrl("a"), null);
  assert.equal(await prefetchPrivateUrl("a"), "u2");
});

await t("kegagalan (null atau lemparan) tidak di-cache dan bisa dicoba lagi", async () => {
  let n = 0;
  setSigner(async () => {
    n++;
    if (n === 1) throw new Error("jaringan");
    if (n === 2) return null;
    return "ok";
  });
  assert.equal(await prefetchPrivateUrl("a"), null);
  assert.equal(cachedPrivateUrl("a"), null);
  assert.equal(await prefetchPrivateUrl("a"), null);
  assert.equal(await prefetchPrivateUrl("a"), "ok");
  assert.equal(cachedPrivateUrl("a"), "ok");
});

await t("tanpa penandatangan terpasang: null, tidak melempar", async () => {
  assert.equal(await prefetchPrivateUrl("a"), null);
});

console.log("SEMUA LULUS");
