import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

/** Signed URL 1 jam untuk sampul lagu pribadi (bucket privat `user-covers`), dibuat sekaligus. path -> URL. */
export async function privateCoverUrls(db: Db, paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  const { data } = await db.storage.from("user-covers").createSignedUrls(unique, 3600);
  for (const u of data ?? []) if (u.path && u.signedUrl) out.set(u.path, u.signedUrl);
  return out;
}
