// Aturan playlist yang murni (tanpa React/Supabase) agar bisa diuji unit. Batas ditegakkan di database
// (trigger enforce_playlist_limit / enforce_playlist_song_limit); angka di sini hanya untuk pesan dan pra-cek UI.

export const MAX_PLAYLISTS = 20;
export const MAX_PLAYLIST_SONGS = 200;
export const MAX_NAME_LENGTH = 60;

export type NameResult = { ok: true; name: string } | { ok: false; message: string };

/** Nama harus tanpa spasi ujung, 1–60 karakter (cermin constraint CHECK di tabel playlists). */
export function validatePlaylistName(raw: string): NameResult {
  const name = raw.trim();
  if (name.length === 0) return { ok: false, message: "Nama playlist tidak boleh kosong." };
  if ([...name].length > MAX_NAME_LENGTH) return { ok: false, message: `Nama playlist paling panjang ${MAX_NAME_LENGTH} karakter.` };
  return { ok: true, name };
}

export type DbError = { code?: string | null; message?: string | null; hint?: string | null } | null | undefined;
export type PlaylistAction = "create" | "rename" | "delete" | "add" | "remove";
export type Described = { kind: "duplicate" | "limit" | "error"; message: string };

/** Menerjemahkan galat Postgres/PostgREST menjadi pesan yang jelas bagi pengguna. */
export function describePlaylistError(err: DbError, action: PlaylistAction, playlistName?: string): Described {
  const text = `${err?.message ?? ""} ${err?.hint ?? ""}`;
  const q = playlistName ? `“${playlistName}”` : "playlist ini";
  if (/playlist_limit/.test(text)) {
    return { kind: "limit", message: `Batas ${MAX_PLAYLISTS} playlist tercapai. Hapus satu playlist untuk membuat yang baru.` };
  }
  if (/playlist_song_limit/.test(text)) {
    return { kind: "limit", message: `${q[0].toUpperCase()}${q.slice(1)} sudah berisi ${MAX_PLAYLIST_SONGS} lagu (batas maksimum). Hapus sebagian lagu dulu.` };
  }
  if (err?.code === "23505" && action === "add") return { kind: "duplicate", message: `Sudah ada di playlist ${q}.` };
  if (err?.code === "23514") return { kind: "error", message: `Nama playlist tidak valid (1–${MAX_NAME_LENGTH} karakter, tanpa spasi di ujung).` };
  const verb = { create: "membuat playlist", rename: "mengganti nama playlist", delete: "menghapus playlist", add: "menambahkan lagu", remove: "menghapus lagu dari playlist" }[action];
  return { kind: "error", message: `Gagal ${verb}. Periksa koneksi lalu coba lagi.` };
}
