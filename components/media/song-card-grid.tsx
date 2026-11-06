"use client";

import { Cover } from "@/components/ui/cover";
import { SongCard } from "@/components/ui/song-card";
import { usePlayer, type Track } from "@/lib/player/store";

/** Kisi kartu lagu. Mengeklik putar mengisi antrean dengan daftar ini, dimulai dari lagu yang diklik. */
export function SongCardGrid({ tracks }: { tracks: Track[] }) {
  const currentId = usePlayer((s) => s.queue[s.index]?.id ?? null);
  const status = usePlayer((s) => s.status);
  const playList = usePlayer((s) => s.playList);
  const toggle = usePlayer((s) => s.toggle);
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-5">
      {tracks.map((t, i) => {
        const current = currentId === t.id && status !== "idle";
        return (
          <SongCard
            key={t.id}
            title={t.title}
            artist={t.artist}
            cover={<Cover src={t.coverUrl} />}
            href={t.albumId ? `/album/${t.albumId}` : undefined}
            playing={current}
            paused={current && status !== "playing" && status !== "loading"}
            onTogglePlay={() => (current ? toggle() : void playList(tracks, i))}
          />
        );
      })}
    </div>
  );
}
