import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "./env";

// Klien untuk Server Components, Server Actions, dan Route Handlers. Berjalan dengan JWT milik user dari cookie.
export async function createClient() {
  const { url, anonKey } = publicEnv();
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Dipanggil dari Server Component (cookie tak bisa ditulis): aman diabaikan karena
          // proxy.ts menyegarkan sesi pada setiap permintaan.
        }
      },
    },
  });
}

// User saat ini, diverifikasi ke server Auth (bukan sekadar membaca cookie). Dipakai Route Handler.
export async function currentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
