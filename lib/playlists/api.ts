import { createClient } from "@/lib/supabase/client";
import type { DbError } from "./rules";

/** Operasi playlist lewat klien browser (JWT pengunjung; RLS menegakkan kepemilikan, trigger menegakkan batas). */
export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: DbError };

const fail = (error: DbError): { ok: false; error: DbError } => ({ ok: false, error });

export async function createPlaylist(name: string): Promise<Result<{ id: string; name: string }>> {
  // user_id default auth.uid() (migrasi 0006)
  const { data, error } = await createClient().from("playlists").insert({ name }).select("id,name").single();
  return error || !data ? fail(error) : { ok: true, data };
}

export async function renamePlaylist(id: string, name: string): Promise<Result> {
  const { error, data } = await createClient().from("playlists").update({ name }).eq("id", id).select("id");
  // RLS menyembunyikan baris milik orang lain: 0 baris terpengaruh = tidak ada/bukan milik sendiri
  if (error) return fail(error);
  return data && data.length > 0 ? { ok: true, data: undefined } : fail({ message: "tidak ditemukan" });
}

export async function deletePlaylist(id: string): Promise<Result> {
  const { error } = await createClient().from("playlists").delete().eq("id", id);
  return error ? fail(error) : { ok: true, data: undefined };
}

export async function addSong(playlistId: string, songId: string): Promise<Result> {
  const { error } = await createClient().from("playlist_songs").insert({ playlist_id: playlistId, song_id: songId });
  return error ? fail(error) : { ok: true, data: undefined };
}

export async function removeSong(playlistId: string, songId: string): Promise<Result> {
  const { error } = await createClient().from("playlist_songs").delete().eq("playlist_id", playlistId).eq("song_id", songId);
  return error ? fail(error) : { ok: true, data: undefined };
}

/** Id playlist milik sendiri yang sudah berisi lagu ini. */
export async function playlistsContaining(songId: string): Promise<Result<string[]>> {
  const { data, error } = await createClient().from("playlist_songs").select("playlist_id").eq("song_id", songId);
  return error ? fail(error) : { ok: true, data: (data ?? []).map((r) => r.playlist_id as string) };
}
