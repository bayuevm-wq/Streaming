// Perlindungan CSRF untuk Route Handler yang mengubah data: header `Origin` harus berasal dari host yang sama dengan
// permintaan. Dibandingkan dengan header Host/X-Forwarded-Host (yang dikirim browser/proxy), BUKAN `req.url`: di balik
// `next start` atau proxy, host pada `req.url` bisa berbeda dari alamat yang dibuka pengguna (mis. localhost vs 127.0.0.1).

/** Murni agar bisa diuji. `origin` null/kosong (permintaan non-browser) ditolak. */
export function isSameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function requestIsSameOrigin(req: Request): boolean {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return isSameOrigin(req.headers.get("origin"), host);
}
