"use client";

import { useRouter } from "next/navigation";
import { Cover } from "@/components/ui/cover";
import { SongRow } from "@/components/ui/song-row";
import { useLikes } from "@/lib/likes/store";
import { removeSong } from "@/lib/playlists/api";
import { describePlaylistError } from "@/lib/playlists/rules";
import { usePlaylists } from "@/lib/playlists/store";
import { usePlaylistUi } from "@/lib/playlists/ui";
import { usePlayer, type Track } from "@/lib/player/store";
import { useToasts } from "@/lib/ui/toasts";

/**
 * Daftar lagu bergaya baris. Mengeklik lagu mengisi antrean dengan seluruh daftar ini, dimulai dari lagu itu (spec F2).
 * Tiap baris punya "+" (Tambahkan ke playlist). Di halaman playlist (`playlist` diberikan) "+" diganti "Hapus dari playlist".
 */
export function TrackList({ tracks, playlist }: { tracks: Track[]; playlist?: { id: string; name: string } }) {
  const router = useRouter();
  const currentId = usePlayer((s) => s.queue[s.index]?.id ?? null);
  const status = usePlayer((s) => s.status);
  const playList = usePlayer((s) => s.playList);
  const toggle = usePlayer((s) => s.toggle);
  const likedIds = useLikes((s) => s.ids);

  async function remove(t: Track) {
    if (!playlist) return;
    const r = await removeSong(playlist.id, t.id);
    if (!r.ok) {
      useToasts.getState().push("error", describePlaylistError(r.error, "remove", playlist.name).message);
      return;
    }
    usePlaylists.getState().adjustCount(playlist.id, -1);
    useToasts.getState().push("success", `“${t.title}” dihapus dari “${playlist.name}”.`);
    router.refresh(); // daftar di server dimuat ulang; pemutaran tidak terganggu (layout tidak di-unmount)
  }

  return (
    <div className="border-t border-hairline">
      {tracks.map((t, i) => {
        const current = currentId === t.id && status !== "idle";
        return (
          <SongRow
            key={t.id}
            index={i + 1}
            title={t.title}
            artist={t.artist}
            album={t.album ?? undefined}
            durationSec={t.durationSec}
            cover={<Cover src={t.coverUrl} />}
            playing={current}
            paused={current && status !== "playing" && status !== "loading"}
            liked={likedIds.has(t.id)}
            onToggleLike={() => void useLikes.getState().toggle(t.id)}
            onTogglePlay={() => (current ? toggle() : void playList(tracks, i))}
            onAddToPlaylist={() => usePlaylistUi.getState().openAdd(t.id, t.title)}
            onRemove={playlist ? () => void remove(t) : undefined}
          />
        );
      })}
    </div>
  );
}
