// Uji logika suka tanpa jaringan. Jalankan: node lib/likes/store.test.ts
import assert from "node:assert/strict";
import { setLikesApi, useLikes } from "./store.ts";
import { useToasts } from "../ui/toasts.ts";

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const pass = (n: string) => console.log(`PASS ${n}`);
const L = () => useLikes.getState();

type Call = { op: "add" | "remove"; id: string };
function makeApi(opts: { delay?: number; failOn?: Set<string> } = {}) {
  const calls: Call[] = [];
  const server = new Set<string>(); // PK (user, lagu): menambah dua kali tidak membuat duplikat
  const run = async (op: Call["op"], id: string) => {
    calls.push({ op, id });
    await tick(opts.delay ?? 0);
    if (opts.failOn?.has(`${op}:${id}`)) throw new Error("server down");
    if (op === "add") server.add(id);
    else server.delete(id);
  };
  setLikesApi({ add: (id) => run("add", id), remove: (id) => run("remove", id) });
  return { calls, server };
}
function reset() {
  L().hydrate([]);
  useToasts.setState({ items: [] });
}

// 1. optimistic: berubah SEBELUM server menjawab
reset();
let h = makeApi({ delay: 30 });
const p = L().toggle("s1");
assert.equal(L().ids.has("s1"), true, "harus langsung tersuka sebelum server menjawab");
assert.equal(h.server.has("s1"), false);
await p;
assert.equal(h.server.has("s1"), true);
pass("toggle optimistic: UI berubah seketika, server menyusul");

// 2. hydrate dari server, lalu batal suka
reset();
h = makeApi();
L().hydrate(["a", "b"]);
await L().toggle("a");
assert.deepEqual([...L().ids].sort(), ["b"]);
assert.deepEqual(h.calls, [{ op: "remove", id: "a" }]);
pass("hydrate lalu batal suka menghapus dari set dan memanggil remove");

// 3. server gagal saat suka: rollback + toast galat
reset();
h = makeApi({ failOn: new Set(["add:s2"]) });
await L().toggle("s2");
assert.equal(L().ids.has("s2"), false, "harus dikembalikan");
assert.equal(useToasts.getState().items.length, 1);
assert.equal(useToasts.getState().items[0].kind, "error");
pass("gagal menyimpan suka: UI dikembalikan dan toast galat muncul");

// 4. server gagal saat batal suka: rollback ke tersuka
reset();
h = makeApi({ failOn: new Set(["remove:s3"]) });
L().hydrate(["s3"]);
await L().toggle("s3");
assert.equal(L().ids.has("s3"), true);
assert.equal(useToasts.getState().items.length, 1);
pass("gagal membatalkan suka: UI kembali tersuka dan toast galat muncul");

// 5. klik cepat berulang (suka, batal, suka) berurutan dan berakhir konsisten dengan server
reset();
h = makeApi({ delay: 15 });
await Promise.all([L().toggle("s4"), L().toggle("s4"), L().toggle("s4")]);
assert.equal(L().ids.has("s4"), true);
assert.equal(h.server.has("s4"), true, "server harus sama dengan UI");
assert.deepEqual(h.calls.map((c) => c.op), ["add", "remove", "add"], "operasi harus berurutan, tanpa tumpang tindih");
pass("klik cepat tiga kali: tiga operasi berurutan, UI dan server konsisten");

// 6. suka lalu batal cepat saat add gagal: tidak ada rollback keliru terhadap klik terakhir
reset();
h = makeApi({ delay: 10, failOn: new Set(["add:s5"]) });
await Promise.all([L().toggle("s5"), L().toggle("s5")]); // suka (gagal) lalu batal suka
assert.equal(L().ids.has("s5"), false, "klik terakhir (batal suka) menentukan hasil akhir");
assert.equal(h.server.has("s5"), false);
pass("add gagal lalu klik batal: hasil akhir tidak tersuka, tanpa rollback yang menimpa klik berikutnya");

// 7. lagu berbeda tidak saling menunggu
reset();
h = makeApi({ delay: 40 });
const t0 = Date.now();
await Promise.all([L().toggle("x"), L().toggle("y")]);
assert.ok(Date.now() - t0 < 75, "dua lagu berbeda berjalan paralel");
assert.equal(L().ids.size, 2);
pass("lagu berbeda diproses paralel");

// 8. set tidak dimutasi (selektor Zustand bergantung pada identitas baru)
reset();
h = makeApi();
const before = L().ids;
await L().toggle("z");
assert.notEqual(L().ids, before, "set harus objek baru setelah toggle");
pass("set diganti objek baru (bukan dimutasi) agar komponen ter-render ulang");
console.log("SEMUA LULUS");
