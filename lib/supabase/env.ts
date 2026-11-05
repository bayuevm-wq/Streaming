// Variabel lingkungan publik. Setiap `process.env.NEXT_PUBLIC_*` harus ditulis LITERAL agar Next.js
// menyisipkannya ke bundle klien; karena itu tidak dibungkus fungsi generik.
export function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY belum diatur (lihat .env.example)",
    );
  }
  return { url, anonKey };
}
