import { expect, type Page } from "@playwright/test";

declare global {
  interface Window {
    __marker?: string;
    __audioRef?: unknown;
  }
}

/** Masuk anonim lewat tombol "Coba tanpa daftar" (Turnstile kunci uji + CAPTCHA Supabase lokal). */
export async function signInAnonymously(page: Page) {
  await page.goto("/masuk");
  await page.getByRole("button", { name: "Coba tanpa daftar" }).click();
  await page.waitForURL((u) => u.pathname === "/", { timeout: 45_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Beranda" })).toBeVisible();
}

export type AudioSample = { t: number; paused: boolean; src: string; sameElement: boolean; audioTags: number; marker: string | null; ended: boolean };

/** Membaca elemen audio singleton (globalThis.__streamingAudio) dan bukti bahwa halaman tidak dimuat ulang. */
export function sampleAudio(page: Page): Promise<AudioSample> {
  return page.evaluate(() => {
    const a = (globalThis as unknown as { __streamingAudio?: HTMLAudioElement }).__streamingAudio;
    return {
      t: a ? a.currentTime : -1,
      paused: a ? a.paused : true,
      src: a ? a.currentSrc : "",
      sameElement: window.__audioRef === a && a !== undefined,
      audioTags: document.querySelectorAll("audio").length,
      marker: window.__marker ?? null,
      ended: a ? a.ended : false,
    };
  });
}

/** Menandai halaman dan elemen audio saat ini. Penanda hilang bila halaman dimuat ulang penuh. */
export async function markPage(page: Page) {
  await page.evaluate(() => {
    window.__marker = "tetap";
    window.__audioRef = (globalThis as unknown as { __streamingAudio?: HTMLAudioElement }).__streamingAudio;
  });
}

/** Menunggu audio benar-benar berjalan (currentTime > batas) setelah klik putar. */
export async function waitForPlayback(page: Page, minSeconds = 0.5) {
  await expect.poll(async () => (await sampleAudio(page)).t, { timeout: 30_000, message: "audio tidak mulai berjalan" }).toBeGreaterThan(minSeconds);
}

export const playerRegion = (page: Page) => page.getByRole("region", { name: "Pemutar musik" });
