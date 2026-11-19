import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CreditItem } from "@/lib/credits";
import { one, type Ref } from "./catalog";

// Kredit lagu katalog publik (kolom license/source_url/credit dari migrasi 0007). Lagu tanpa lisensi (lagu lama atau
// pribadi) tidak ikut. Urutan = urutan seed (created_at), jadi mengikuti urutan katalog.json.

export type CreditRow = {
  id: string;
  title: string;
  license: string | null;
  source_url: string | null;
  credit: string | null;
  artist: Ref<{ name: string }>;
  album: Ref<{ title: string }>;
};

export const CREDIT_COLUMNS = "license,source_url,credit";

export function toCredit(r: CreditRow): CreditItem | null {
  if (!r.license || !r.source_url || !r.credit) return null;
  return {
    id: r.id,
    title: r.title,
    artist: one(r.artist)?.name ?? "Artis tidak diketahui",
    album: one(r.album)?.title ?? null,
    license: r.license,
    sourceUrl: r.source_url,
    credit: r.credit,
  };
}

export async function getCredits(): Promise<CreditItem[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("songs")
    .select("id,title,license,source_url,credit,artist:artists(name),album:albums(title)")
    .eq("visibility", "public")
    .not("license", "is", null)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(`Gagal memuat kredit: ${error.message}`);
  return (data as unknown as CreditRow[]).map(toCredit).filter((c): c is CreditItem => c !== null);
}
