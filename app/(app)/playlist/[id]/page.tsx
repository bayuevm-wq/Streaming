import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlaylistActions } from "@/components/app/playlist-actions";
import { PlayAllButton } from "@/components/media/play-all-button";
import { TrackList } from "@/components/media/track-list";
import { EmptyState } from "@/components/ui/empty-state";
import { IconPlaylist } from "@/components/ui/icons";
import { getPlaylist } from "@/lib/data/playlists";
import { formatTotalDuration } from "@/lib/format";

export const metadata: Metadata = { title: "Playlist — Streaming" };

// Playlist milik orang lain (atau ID tidak valid/tidak ada) => 404 yang sama: keberadaannya tidak bocor.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playlist = await getPlaylist(id);
  if (!playlist) notFound();
  const { name, tracks } = playlist;
  const total = formatTotalDuration(tracks.reduce((n, t) => n + t.durationSec, 0));

  return (
    <div className="grid gap-8 px-6 py-8">
      <header className="grid gap-3">
        <p className="text-small text-muted">Playlist</p>
        <h1 className="font-display text-display font-medium italic text-balance">{name}</h1>
        <p className="text-body text-muted">
          {tracks.length} lagu{tracks.length ? ` · ${total}` : ""}
        </p>
        <div className="flex flex-wrap gap-3">
          <PlayAllButton tracks={tracks} label="Putar playlist" />
          <PlaylistActions id={playlist.id} name={name} />
        </div>
      </header>
      {tracks.length === 0 ? (
        <EmptyState
          icon={<IconPlaylist />}
          title="Playlist ini masih kosong"
          description="Tambahkan lagu dengan tombol + di baris lagu mana pun (beranda, album, artis, atau hasil pencarian)."
        />
      ) : (
        <TrackList tracks={tracks} playlist={{ id: playlist.id, name }} />
      )}
    </div>
  );
}
