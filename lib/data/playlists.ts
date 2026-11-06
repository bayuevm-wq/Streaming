import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Track } from "@/lib/player/store";
import { isUuid, SONG_SELECT, toTrack, type SongRow, one, type Ref } from "./catalog";
import type { PlaylistSummary } from "@/lib/playlists/store";

// Playlist bersifat pribadi: RLS hanya mengembalikan baris milik pengunjung. Playlist orang lain tampak seperti
// "tidak ada" (getPlaylist => null => 404), tidak pernah "dilarang", agar keberadaannya tidak bocor.

export async function getPlaylists(): Promise<PlaylistSummary[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("playlists")
    .select("id,name,created_at,playlist_songs(count)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Gagal memuat playlist: ${error.message}`);
  return (data as unknown as { id: string; name: string; playlist_songs: { count: number }[] }[]).map((p) => ({
    id: p.id,
    name: p.name,
    count: p.playlist_songs?.[0]?.count ?? 0,
  }));
}

export async function getPlaylist(id: string): Promise<{ id: string; name: string; tracks: Track[] } | null> {
  if (!isUuid(id)) return null;
  const db = await createClient();
  const { data: pl, error } = await db.from("playlists").select("id,name").eq("id", id).maybeSingle();
  if (error) throw new Error(`Gagal memuat playlist: ${error.message}`);
  if (!pl) return null;
  const { data, error: sErr } = await db
    .from("playlist_songs")
    .select(`position, song:songs(${SONG_SELECT})`)
    .eq("playlist_id", id)
    .order("position", { ascending: true });
  if (sErr) throw new Error(`Gagal memuat lagu playlist: ${sErr.message}`);
  const tracks = (data as unknown as { song: Ref<SongRow> }[])
    .map((r) => one(r.song))
    .filter((s): s is SongRow => s !== null)
    .map(toTrack);
  return { id: pl.id as string, name: pl.name as string, tracks };
}
