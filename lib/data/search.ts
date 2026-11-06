import "server-only";
import { createClient } from "@/lib/supabase/server";
import { publicStorageUrl } from "@/lib/storage-url";
import type { Track } from "@/lib/player/store";
import type { AlbumItem, ArtistItem } from "./catalog";

// Pencarian lewat RPC `search_all` (SECURITY INVOKER, jadi RLS berlaku): lagu publik + lagu pribadi MILIK SENDIRI yang
// belum kedaluwarsa. Input di-escape di SQL dan dikirim sebagai parameter (bukan digabung ke string SQL).

type SongHit = {
  id: string;
  title: string;
  visibility: "public" | "private";
  audio_path: string;
  cover_path: string | null;
  duration_sec: number;
  artist: string | null;
  album: string | null;
};
type AlbumHit = { id: string; title: string; cover_path: string | null; artist: string | null };
type ArtistHit = { id: string; name: string; image_path: string | null };
type Payload = { songs: SongHit[]; albums: AlbumHit[]; artists: ArtistHit[] };

export const MAX_QUERY_LENGTH = 100;

/** Merapikan masukan pengguna: pangkas spasi dan batasi panjang. Kosong => tidak ada permintaan. */
export function normalizeQuery(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (v ?? "").trim().slice(0, MAX_QUERY_LENGTH);
}

export async function searchAll(q: string) {
  const db = await createClient();
  const { data, error } = await db.rpc("search_all", { p_q: q, p_limit: 20 });
  if (error) throw new Error(`Pencarian gagal: ${error.message}`);
  const r = data as Payload;
  const tracks: Track[] = r.songs.map((s) => ({
    id: s.id,
    title: s.title,
    artist: s.artist ?? "Artis tidak diketahui",
    album: s.album,
    coverUrl: s.visibility === "public" ? publicStorageUrl("covers", s.cover_path) : null, // sampul pribadi: signed URL (Fase 4)
    audioUrl: s.visibility === "public" ? publicStorageUrl("audio", s.audio_path) : null, // lagu pribadi: signed URL saat diputar (Fase 4)
    durationSec: s.duration_sec,
    visibility: s.visibility,
  }));
  const albums: AlbumItem[] = r.albums.map((a) => ({
    id: a.id,
    title: a.title,
    year: null,
    coverUrl: publicStorageUrl("covers", a.cover_path),
    artistId: "",
    artistName: a.artist ?? "Artis tidak diketahui",
  }));
  const artists: ArtistItem[] = r.artists.map((a) => ({ id: a.id, name: a.name, imageUrl: publicStorageUrl("covers", a.image_path) }));
  return { tracks, albums, artists };
}
