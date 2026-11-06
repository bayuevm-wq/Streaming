"use client";

import { useState } from "react";
import { Cover } from "@/components/ui/cover";
import { PlayerBar } from "@/components/ui/player-bar";
import { usePlayer, useProgress } from "@/lib/player/store";
import { QueueDialog } from "./queue-dialog";

/** Player bar global di dasar layar. Tidak tampil sebelum ada lagu. Like menyusul di Fase 3 (prop tidak diberikan). */
export function PlayerDock() {
  const track = usePlayer((s) => s.queue[s.index]);
  const status = usePlayer((s) => s.status);
  const volume = usePlayer((s) => s.volume);
  const { toggle, next, prev, seek, setVolume } = usePlayer.getState();
  const position = useProgress((s) => s.position);
  const duration = useProgress((s) => s.duration);
  const [queueOpen, setQueueOpen] = useState(false);

  return (
    <>
      {track ? (
        <PlayerBar
          track={{ title: track.title, artist: track.artist, cover: <Cover src={track.coverUrl} /> }}
          playing={status === "playing"}
          position={position}
          duration={duration || track.durationSec}
          volume={volume}
          onTogglePlay={toggle}
          onPrev={() => void prev()}
          onNext={() => void next()}
          onSeek={seek}
          onVolume={setVolume}
          onOpenQueue={() => setQueueOpen(true)}
        />
      ) : null}
      <QueueDialog open={queueOpen} onClose={() => setQueueOpen(false)} />
    </>
  );
}
