import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "./env";

// Klien untuk komponen klien (browser). Memakai anon key + JWT user; semua akses dibatasi RLS.
export function createClient() {
  const { url, anonKey } = publicEnv();
  return createBrowserClient(url, anonKey);
}
