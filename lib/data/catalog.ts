import "server-only";
import { createClient } from "@/lib/supabase/server";
import { privateCoverUrls } from "./private-covers";
import { publicStorageUrl } from "@/lib/storage-url";
import type { Track } from "@/lib/player/store";

// Akses data katalog publik lewat RLS dengan JWT pengunjung (artists, albums, songs publik bisa dibaca semua user
// ter-autentikasi). Tidak memakai service role.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** ID bukan UUID dianggap tidak ada (menghindari galat 22P02 dari Postgres). */
export const isUuid = (v: string) => UUID.test(v);

export type Ref<T> = T | T[] | null; // PostgREST bisa mengembalikan objek atau larik untuk relasi
export const one = <T>(r: Ref<T>): T | null => (Array.isArray(r) ? (r[0] ?? null) : r);

export type SongRow = {
  id: string;
  title: string;
  duration_sec: number;
  audio_path: string;
  cover_path: string | null;
  track_no: number | null;
  visibility: "public" | "private";
  artist: Ref<{ id: string; name: string }>;
  album: Ref<{ id: string; title: string; cover_path: string | null }>;
};
export type AlbumItem = { id: string; title: string; year: number | null; coverUrl: string | null; artistId: string; artistName: string };
export type ArtistItem = { id: string; name: string; imageUrl: string | null };

export const SONG_SELECT = "id,title,duration_sec,audio_path,cover_path,track_no,visibility,artist:artists(id,name),album:albums(id,title,cover_path)";

/**
 * Lagu publik: URL publik Storage. Lagu PRIBADI (muncul di playlist/Disukai milik sendiri): tanpa audioUrl (signed URL dibuat
 * saat diputar, jalur pribadi di store) dan sampul dari `privateCovers` (signed URL) bila ada. Menandai pribadi sebagai
 * publik akan membuatnya tak pernah bisa diputar (URL publik tidak ada).
 */
export function toTrack(r: SongRow, privateCovers?: Map<string, string>): Track {
  const artist = one(r.artist);
  const album = one(r.album);
  const priv = r.visibility === "private";
  return {
    id: r.id,
    title: r.title,
    artist: artist?.name ?? "Artis tidak diketahui",
    artistId: artist?.id ?? null,
    album: album?.title ?? null,
    albumId: album?.id ?? null,
    // Sampul lagu sendiri, lalu sampul album; null => placeholder.
    coverUrl: priv ? (r.cover_path ? (privateCovers?.get(r.cover_path) ?? null) : null) : publicStorageUrl("covers", r.cover_path) ?? publicStorageUrl("covers", album?.cover_path),
    audioUrl: priv ? null : publicStorageUrl("audio", r.audio_path),
    durationSec: r.duration_sec,
    visibility: r.visibility,
  };
}

type AlbumRow = { id: string; title: string; year: number | null; cover_path: string | null; artist: Ref<{ id: string; name: string }> };
const toAlbum = (r: AlbumRow): AlbumItem => {
  const artist = one(r.artist);
  return {
    id: r.id,
    title: r.title,
    year: r.year,
    coverUrl: publicStorageUrl("covers", r.cover_path),
    artistId: artist?.id ?? "",
    artistName: artist?.name ?? "Artis tidak diketahui",
  };
};
const ALBUM_SELECT = "id,title,year,cover_path,artist:artists(id,name)";
const toArtist = (r: { id: string; name: string; image_path: string | null }): ArtistItem => ({
  id: r.id,
  name: r.name,
  imageUrl: publicStorageUrl("covers", r.image_path),
});

export async function getHome() {
  const db = await createClient();
  const [songs, albums, artists] = await Promise.all([
    db.from("songs").select(SONG_SELECT).eq("visibility", "public").order("created_at", { ascending: false }).limit(12),
    db.from("albums").select(ALBUM_SELECT).order("created_at", { ascending: false }).limit(12),
    db.from("artists").select("id,name,image_path").order("created_at", { ascending: false }).limit(12),
  ]);
  const err = songs.error ?? albums.error ?? artists.error;
  if (err) throw new Error(`Gagal memuat beranda: ${err.message}`);
  return {
    songs: (songs.data as unknown as SongRow[]).map((s) => toTrack(s)),
    albums: (albums.data as unknown as AlbumRow[]).map(toAlbum),
    artists: (artists.data as { id: string; name: string; image_path: string | null }[]).map(toArtist),
  };
}

export async function getAlbum(id: string) {
  if (!isUuid(id)) return null;
  const db = await createClient();
  const { data: album, error } = await db.from("albums").select(ALBUM_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(`Gagal memuat album: ${error.message}`);
  if (!album) return null;
  const { data: songs, error: sErr } = await db
    .from("songs")
    .select(SONG_SELECT)
    .eq("album_id", id)
    .eq("visibility", "public")
    .order("track_no", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (sErr) throw new Error(`Gagal memuat lagu album: ${sErr.message}`);
  return { album: toAlbum(album as unknown as AlbumRow), tracks: (songs as unknown as SongRow[]).map((s) => toTrack(s)) };
}

export async function getArtist(id: string) {
  if (!isUuid(id)) return null;
  const db = await createClient();
  const { data: artist, error } = await db.from("artists").select("id,name,image_path").eq("id", id).maybeSingle();
  if (error) throw new Error(`Gagal memuat artis: ${error.message}`);
  if (!artist) return null;
  const [albums, songs] = await Promise.all([
    db.from("albums").select(ALBUM_SELECT).eq("artist_id", id).order("year", { ascending: false, nullsFirst: false }),
    db.from("songs").select(SONG_SELECT).eq("artist_id", id).eq("visibility", "public").order("created_at", { ascending: false }),
  ]);
  const err = albums.error ?? songs.error;
  if (err) throw new Error(`Gagal memuat artis: ${err.message}`);
  return {
    artist: toArtist(artist),
    albums: (albums.data as unknown as AlbumRow[]).map(toAlbum),
    tracks: (songs.data as unknown as SongRow[]).map((s) => toTrack(s)),
  };
}

/** Id semua lagu yang disukai pengguna ini (RLS: hanya milik sendiri). Dipakai layout untuk mengisi store suka. */
export async function getLikedIds(): Promise<string[]> {
  const db = await createClient();
  const { data, error } = await db.from("likes").select("song_id");
  if (error) throw new Error(`Gagal memuat daftar suka: ${error.message}`);
  return (data ?? []).map((r) => r.song_id as string);
}

/** Lagu yang disukai, terbaru dulu. Lagu yang tak lagi terlihat (mis. pribadi kedaluwarsa) tersaring oleh RLS. */
export async function getLikedTracks(): Promise<Track[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("likes")
    .select(`created_at, song:songs(${SONG_SELECT})`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Gagal memuat lagu disukai: ${error.message}`);
  const songs = (data as unknown as { song: Ref<SongRow> }[]).map((r) => one(r.song)).filter((s): s is SongRow => s !== null);
  const covers = await privateCoverUrls(db, songs.filter((s) => s.visibility === "private").map((s) => s.cover_path));
  return songs.map((s) => toTrack(s, covers));
}
