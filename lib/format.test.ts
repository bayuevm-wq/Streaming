import assert from "node:assert/strict";
import { formatTime, formatTotalDuration } from "./format.ts";

const cases: [number, string][] = [
  [0, "0 dtk"],
  [45, "45 dtk"],
  [60, "1 mnt"],
  [92, "1 mnt 32 dtk"], // kasus yang dikeluhkan: bukan "2 menit"
  [599, "9 mnt 59 dtk"],
  [600, "10 mnt"],
  [1799, "29 mnt"], // dibulatkan ke bawah
  [3599, "59 mnt"],
  [3600, "1 jam"],
  [3925, "1 jam 5 mnt"],
  [7200, "2 jam"],
  [-5, "0 dtk"],
  [92.9, "1 mnt 32 dtk"],
];
for (const [input, want] of cases) {
  assert.equal(formatTotalDuration(input), want, `formatTotalDuration(${input})`);
  console.log(`PASS ${input} -> ${want}`);
}
assert.equal(formatTime(92), "1:32");
assert.equal(formatTime(3725), "1:02:05");
console.log("SEMUA LULUS");
