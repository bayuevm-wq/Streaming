import "server-only"; // impor dari komponen klien akan gagal saat build, jadi service role tak bisa bocor ke browser
import { createClient } from "@supabase/supabase-js";

// Klien service role: MELEWATI RLS. Hanya untuk Route Handler `finalize`, penghapusan lagu, dan skrip/job.
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diatur");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type Admin = ReturnType<typeof adminClient>;
