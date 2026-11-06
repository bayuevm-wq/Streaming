import assert from "node:assert/strict";
import { isSameOrigin } from "./origin.ts";

const t = (n: string, fn: () => void) => (fn(), console.log(`PASS ${n}`));
t("host sama (IP:port) lolos", () => assert.equal(isSameOrigin("http://127.0.0.1:3000", "127.0.0.1:3000"), true));
t("host sama (domain https) lolos", () => assert.equal(isSameOrigin("https://app.example.com", "app.example.com"), true));
t("origin lain ditolak", () => assert.equal(isSameOrigin("https://evil.example", "127.0.0.1:3000"), false));
t("port berbeda ditolak", () => assert.equal(isSameOrigin("http://127.0.0.1:4000", "127.0.0.1:3000"), false));
t("subdomain mirip ditolak", () => assert.equal(isSameOrigin("https://app.example.com.evil.io", "app.example.com"), false));
t("tanpa Origin atau Host ditolak", () => {
  assert.equal(isSameOrigin(null, "x"), false);
  assert.equal(isSameOrigin("http://x", null), false);
});
t("Origin tak valid ditolak tanpa melempar", () => assert.equal(isSameOrigin("bukan-url", "x"), false));
console.log("SEMUA LULUS");
