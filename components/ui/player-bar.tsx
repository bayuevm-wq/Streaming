"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import { Time } from "./time";
import { IconHeart, IconNext, IconPause, IconPlay, IconPrev, IconQueue, IconVolume } from "./icons";
import { Slider } from "./slider";

type Props = {
  track: { title: string; artist: string; cover: ReactNode };
  playing: boolean;
  /** Posisi dan panjang lagu, dalam detik. */
  position: number;
  duration: number;
  /** 0-100. */
  volume: number;
  liked: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onVolume: (value: number) => void;
  onToggleLike: () => void;
  onOpenQueue: () => void;
  className?: string;
};

/**
 * Player bar. Presentasional: state dan elemen audio ada di store pemutar (Fase 2).
 * Slider posisi memberi tahu pembaca layar "1:24 dari 3:42" dan bisa digeser dengan panah (±5 dtk), Home/End.
 * Di <= 760px tata letak menumpuk dan volume disembunyikan (volume diatur perangkat).
 */
export function PlayerBar(p: Props) {
  const posText = `${formatTime(p.position)} dari ${formatTime(p.duration)}`;
  return (
    <section
      aria-label="Pemutar musik"
      className={cn(
        "grid items-center gap-x-5 gap-y-3 border-t-2 border-accent bg-surface px-4 py-3",
        "grid-cols-[minmax(0,1.3fr)_minmax(0,1.9fr)_auto] tablet:grid-cols-1",
        p.className,
      )}
    >
      {/* Pengumuman perubahan lagu untuk pembaca layar, tanpa memindahkan fokus */}
      <p className="sr-only" aria-live="polite">
        {p.playing ? "Sedang diputar" : "Dijeda"}: {p.track.title}, {p.track.artist}
      </p>

      <div className="flex min-w-0 items-center gap-3.5">
        <div className="w-14 shrink-0">{p.track.cover}</div>
        <div className="min-w-0">
          <p className="truncate font-display text-title font-medium italic leading-tight">{p.track.title}</p>
          <p className="truncate text-small text-muted">{p.track.artist}</p>
        </div>
      </div>

      <div className="grid min-w-0 gap-1.5">
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={p.onPrev}
            aria-label="Lagu sebelumnya"
            className="grid size-10 place-items-center text-lead text-ink hover:bg-raised"
          >
            <IconPrev />
          </button>
          <button
            type="button"
            onClick={p.onTogglePlay}
            aria-label={p.playing ? "Jeda" : "Putar"}
            className="grid size-11 place-items-center bg-accent text-title text-on-accent hover:bg-accent-hover"
          >
            {p.playing ? <IconPause /> : <IconPlay />}
          </button>
          <button
            type="button"
            onClick={p.onNext}
            aria-label="Lagu berikutnya"
            className="grid size-10 place-items-center text-lead text-ink hover:bg-raised"
          >
            <IconNext />
          </button>
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 text-caption text-muted tabular-nums">
          <Time seconds={p.position} />
          <Slider
            variant="ruler"
            label="Posisi lagu"
            value={p.position}
            max={p.duration}
            step={1}
            valueText={posText}
            onValueChange={p.onSeek}
          />
          <Time seconds={p.duration} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-1 text-muted tablet:hidden">
        <button
          type="button"
          onClick={p.onToggleLike}
          aria-pressed={p.liked}
          aria-label={p.liked ? "Batal suka lagu ini" : "Sukai lagu ini"}
          className={cn("grid size-10 place-items-center text-lead hover:bg-raised", p.liked ? "text-accent" : "text-muted hover:text-ink")}
        >
          <IconHeart filled={p.liked} />
        </button>
        <button type="button" onClick={p.onOpenQueue} aria-label="Buka antrean" className="grid size-10 place-items-center text-lead hover:bg-raised hover:text-ink">
          <IconQueue />
        </button>
        <IconVolume className="ml-2 text-lead" />
        <Slider className="w-24" label="Volume" value={p.volume} max={100} step={5} valueText={`${p.volume}%`} onValueChange={p.onVolume} />
      </div>
    </section>
  );
}
