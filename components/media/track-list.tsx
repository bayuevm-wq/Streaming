"use client";

import { Cover } from "@/components/ui/cover";
import { SongRow } from "@/components/ui/song-row";
import { usePlayer, type Track } from "@/lib/player/store";

/** Daftar lagu bergaya baris. Mengeklik lagu mengisi antrean dengan seluruh daftar ini, dimulai dari lagu itu (spec F2). */
export function TrackList({ tracks }: { tracks: Track[] }) {
  const currentId = usePlayer((s) => s.queue[s.index]?.id ?? null);
  const status = usePlayer((s) => s.status);
  const playList = usePlayer((s) => s.playList);
  const toggle = usePlayer((s) => s.toggle);
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
            onTogglePlay={() => (current ? toggle() : void playList(tracks, i))}
          />
        );
      })}
    </div>
  );
}
