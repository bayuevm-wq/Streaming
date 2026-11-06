import { expect, type Page } from "@playwright/test";
import { PNG_1X1, silentMp3 } from "../scripts/seed/make-sample.ts";
import { waitHydrated } from "./helpers";

// Pembantu bersama E2E unggah/library/playlist: mengisi formulir /unggah dan akses REST service role (hanya untuk uji).

export { silentMp3 };
export const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
export const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY!, authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json", prefer: "return=minimal", ...init.headers },
  });

export type Opts = { name?: string; bytes?: Uint8Array; title: string; artist?: string; album?: string; cover?: boolean };

/** Mengisi dan mengirim formulir /unggah. Tidak menunggu hasil. */
export async function fillAndSubmit(page: Page, o: Opts) {
  await page.goto("/unggah");
  await expect(page.getByRole("heading", { level: 1, name: "Unggah lagu" })).toBeVisible();
  await waitHydrated(page);
  await page.locator("#audio").setInputFiles({ name: o.name ?? "lagu.mp3", mimeType: "audio/mpeg", buffer: Buffer.from(o.bytes ?? silentMp3(30)) });
  await page.getByLabel("Judul", { exact: true }).fill(o.title);
  await page.getByLabel("Artis", { exact: true }).fill(o.artist ?? "Penguji");
  if (o.album) await page.getByLabel(/^Album/).fill(o.album);
  if (o.cover) await page.locator("#cover").setInputFiles({ name: "sampul.png", mimeType: "image/png", buffer: Buffer.from(PNG_1X1) });
  await page.getByRole("button", { name: "Unggah", exact: true }).click();
}

export async function uploadOk(page: Page, o: Opts) {
  await fillAndSubmit(page, o);
  await expect(page).toHaveURL((u) => u.pathname === "/library", { timeout: 60_000 });
  await expect(page.getByText(o.title, { exact: true }).first()).toBeVisible();
}

export const slots = (page: Page) => page.getByTestId("slots");
