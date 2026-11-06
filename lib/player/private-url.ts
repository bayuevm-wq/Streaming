// URL audio lagu pribadi = signed URL 1 jam (keputusan spec #6). Risiko Safari/iOS (spike S4): `play()` yang dipanggil
// SETELAH `await createSignedUrl(...)` bisa kehilangan "user activation" dari ketukan pengguna, sehingga putar pertama
// ditolak (NotAllowedError). Fallback: pra-ambil URL begitu lagu pribadi tampil di daftar, lalu saat diketuk URL sudah
// ada di cache dan `play()` dipanggil sinkron di handler ketukan (tanpa await jaringan di antaranya).
//
// Modul ini tidak bergantung pada React/Supabase: penandatangan URL disuntikkan, jadi bisa diuji unit.

export type Signer = (songId: string) => Promise<string | null>;

const TTL_MS = 50 * 60 * 1000; // signed URL berumur 60 menit; dibuang lebih awal agar tak habis di tengah lagu

type Entry = { url: string; at: number };
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<string | null>>();
let signer: Signer | null = null;
let now: () => number = () => Date.now();

export function setSigner(fn: Signer | null) {
  signer = fn;
}
/** Hanya untuk uji. */
export function __setClock(fn: () => number) {
  now = fn;
}
export function clearPrivateUrls() {
  cache.clear();
  inflight.clear();
}

/** URL yang sudah di-cache dan masih segar, atau null. SINKRON: aman dipanggil di dalam handler ketukan. */
export function cachedPrivateUrl(songId: string): string | null {
  const e = cache.get(songId);
  if (!e) return null;
  if (now() - e.at > TTL_MS) {
    cache.delete(songId);
    return null;
  }
  return e.url;
}

/** Mengambil (dan meng-cache) URL. Permintaan bersamaan untuk lagu yang sama dijadikan satu. Kegagalan tidak di-cache. */
export function prefetchPrivateUrl(songId: string): Promise<string | null> {
  const hit = cachedPrivateUrl(songId);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(songId);
  if (pending) return pending;
  if (!signer) return Promise.resolve(null);
  const p = signer(songId)
    .then((url) => {
      if (url) cache.set(songId, { url, at: now() });
      return url;
    })
    .catch(() => null)
    .finally(() => inflight.delete(songId));
  inflight.set(songId, p);
  return p;
}
