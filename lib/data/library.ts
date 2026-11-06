import "server-only";
import { createClient } from "@/lib/supabase/server";
import { privateCoverUrls } from "./private-covers";
import type { Track } from "@/lib/player/store";

// Lagu pribadi milik pengunjung. RLS (songs_read) hanya mengembalikan baris status 'ready', milik sendiri, dan belum
// kedaluwarsa, jadi tidak ada filter waktu di sini yang bisa "lupa". Audio TIDAK disertakan: signed URL dibuat saat
// lagu akan diputar (spec F5).

export type UploadStatus = { active: number; max: number; storage_open: boolean };
export type PrivateTrack = Track & { expiresAt: string };

export async function getUploadStatus(): Promise<UploadStatus> {
  const db = await createClient();
  const { data, error } = await db.rpc("get_upload_status");
  if (error) throw new Error(`Gagal memuat status unggah: ${error.message}`);
  return data as UploadStatus;
}

export async function getMyLibrary(): Promise<PrivateTrack[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("songs")
    .select("id,title,artist_name,album_name,cover_path,duration_sec,expires_at")
    .eq("visibility", "private")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Gagal memuat library: ${error.message}`);
  const rows = data as {
    id: string; title: string; artist_name: string | null; album_name: string | null;
    cover_path: string | null; duration_sec: number; expires_at: string;
  }[];

  // sampul pribadi: signed URL 1 jam, dibuat bersamaan untuk semua baris
  const signed = await privateCoverUrls(db, rows.map((r) => r.cover_path));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    artist: r.artist_name ?? "Artis tidak diketahui",
    album: r.album_name,
    coverUrl: r.cover_path ? (signed.get(r.cover_path) ?? null) : null,
    audioUrl: null,
    durationSec: r.duration_sec,
    visibility: "private" as const,
    expiresAt: r.expires_at,
  }));
}
