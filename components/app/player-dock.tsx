"use client";

import { useState } from "react";
import { Cover } from "@/components/ui/cover";
import { FullPlayer } from "@/components/ui/full-player";
import { MiniPlayer } from "@/components/ui/mini-player";
import { PlayerBar } from "@/components/ui/player-bar";
import { useLikes } from "@/lib/likes/store";
import { usePlayer, useProgress } from "@/lib/player/store";
import { MiniProgress } from "./mini-progress";
import { QueueDialog } from "./queue-dialog";

/**
 * Pemutar global di dasar layar. Desktop: PlayerBar penuh. Ponsel (<= 760px): MiniPlayer satu baris; mengetuknya
 * membuka FullPlayer. Salah satu disembunyikan CSS (display: none), jadi hanya satu yang ada di pohon aksesibilitas.
 * Tidak tampil sebelum ada lagu. Like menyusul di Fase 3 (prop tidak diberikan).
 */
export function PlayerDock() {
  const track = usePlayer((s) => s.queue[s.index]);
  const status = usePlayer((s) => s.status);
  const volume = usePlayer((s) => s.volume);
  const { toggle, next, prev, seek, setVolume } = usePlayer.getState();
  const position = useProgress((s) => s.position);
  const duration = useProgress((s) => s.duration);
  const likedIds = useLikes((s) => s.ids);
  const [queueOpen, setQueueOpen] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);

  const playing = status === "playing";
  const liked = track ? likedIds.has(track.id) : false;
  const toggleLike = () => {
    if (track) void useLikes.getState().toggle(track.id);
  };
  const total = duration || track?.durationSec || 0;

  return (
    <>
      {track ? (
        <>
          <PlayerBar
            className="tablet:hidden"
            track={{ title: track.title, artist: track.artist, cover: <Cover src={track.coverUrl} /> }}
            playing={playing}
            position={position}
            duration={total}
            volume={volume}
            onTogglePlay={toggle}
            onPrev={() => void prev()}
            onNext={() => void next()}
            onSeek={seek}
            onVolume={setVolume}
            onOpenQueue={() => setQueueOpen(true)}
            liked={liked}
            onToggleLike={toggleLike}
          />
          <MiniPlayer
            className="hidden tablet:block"
            track={{ title: track.title, artist: track.artist, cover: <Cover src={track.coverUrl} /> }}
            playing={playing}
            progress={<MiniProgress fallbackDuration={track.durationSec} />}
            onTogglePlay={toggle}
            onNext={() => void next()}
            onOpen={() => setFullOpen(true)}
          />
          <FullPlayer
            open={fullOpen}
            onClose={() => setFullOpen(false)}
            track={{ title: track.title, artist: track.artist, cover: <Cover src={track.coverUrl} /> }}
            playing={playing}
            position={position}
            duration={total}
            onTogglePlay={toggle}
            onPrev={() => void prev()}
            onNext={() => void next()}
            onSeek={seek}
            onOpenQueue={() => setQueueOpen(true)}
            liked={liked}
            onToggleLike={toggleLike}
          />
        </>
      ) : null}
      <QueueDialog open={queueOpen} onClose={() => setQueueOpen(false)} />
    </>
  );
}
