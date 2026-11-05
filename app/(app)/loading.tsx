// Boundary Suspense untuk seluruh halaman di area (app). Semua halaman membaca data runtime (cookie sesi,
// params), jadi shell statis (layout) dikirim dulu dan isi halaman mengalir menyusul.
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse space-y-3 p-8" aria-busy="true" aria-label="Memuat">
      <div className="h-7 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-4 w-72 rounded bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}
