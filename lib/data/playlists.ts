import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Track } from "@/lib/player/store";
import { privateCoverUrls } from "./private-covers";
import { isUuid, SONG_SELECT, toTrack, type SongRow, one, type Ref } from "./catalog";
import type { PlaylistSummary } from "@/lib/playlists/store";

// Playlist bersifat pribadi: RLS hanya mengembalikan baris milik pengunjung. Playlist orang lain tampak seperti
// "tidak ada" (getPlaylist => null => 404), tidak pernah "dilarang", agar keberadaannya tidak bocor.

export async function getPlaylists(): Promise<PlaylistSummary[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("playlists")
    // songs(id) dikembalikan null untuk lagu yang tak lagi terlihat (RLS: pribadi kedaluwarsa/dihapus), jadi hitungan
    // hanya memuat lagu yang benar-benar tampil di playlist (spec F8: lagu kedaluwarsa hilang tanpa error).
    .select("id,name,created_at,playlist_songs(songs(id))")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Gagal memuat playlist: ${error.message}`);
  return (data as unknown as { id: string; name: string; playlist_songs: { songs: Ref<{ id: string }> }[] }[]).map((p) => ({
    id: p.id,
    name: p.name,
    count: (p.playlist_songs ?? []).filter((ps) => one(ps.songs) !== null).length,
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
  const songs = (data as unknown as { song: Ref<SongRow> }[]).map((r) => one(r.song)).filter((s): s is SongRow => s !== null);
  const covers = await privateCoverUrls(db, songs.filter((s) => s.visibility === "private").map((s) => s.cover_path));
  const tracks = songs.map((s) => toTrack(s, covers));
  return { id: pl.id as string, name: pl.name as string, tracks };
}
