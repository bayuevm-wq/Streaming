"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Time } from "./time";
import { formatTime } from "@/lib/format";
import { IconClose, IconNext, IconPause, IconPlay, IconPrev, IconQueue } from "./icons";
import { Slider } from "./slider";

type Props = {
  open: boolean;
  onClose: () => void;
  track: { title: string; artist: string; cover: ReactNode };
  playing: boolean;
  position: number;
  duration: number;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onOpenQueue: () => void;
};

/**
 * Pemutar penuh untuk ponsel: layar penuh di atas <dialog> asli (fokus terkunci, Esc menutup, fokus kembali ke
 * mini-player). Sampul besar, slider posisi (penggaris, bisa digeser dengan panah), kontrol besar, dan tombol antrean.
 * Volume tidak ada: diatur perangkat.
 */
export function FullPlayer({ open, onClose, track, playing, position, duration, onTogglePlay, onPrev, onNext, onSeek, onOpenQueue }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label="Pemutar"
      onClose={onClose}
      className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-ground p-0 text-ink backdrop:bg-scrim"
    >
      <div className="mx-auto flex h-full max-w-md flex-col gap-6 px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <p className="text-small text-muted">{playing ? "Sedang diputar" : "Dijeda"}</p>
          <button type="button" onClick={onClose} aria-label="Tutup pemutar" className="grid size-10 place-items-center text-title hover:bg-raised">
            <IconClose />
          </button>
        </div>

        <div className="mx-auto w-full max-w-xs">{track.cover}</div>

        <div className="grid gap-1">
          <h2 className="font-display text-heading font-medium italic text-balance">{track.title}</h2>
          <p className="text-body text-muted">{track.artist}</p>
        </div>

        <div className="grid gap-1">
          <Slider
            variant="ruler"
            label="Posisi lagu"
            value={position}
            max={duration}
            step={1}
            valueText={`${formatTime(position)} dari ${formatTime(duration)}`}
            onValueChange={onSeek}
          />
          <div className="flex justify-between text-caption text-muted">
            <Time seconds={position} />
            <Time seconds={duration} />
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button type="button" onClick={onPrev} aria-label="Lagu sebelumnya" className="grid size-12 place-items-center text-title hover:bg-raised">
            <IconPrev />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={playing ? "Jeda" : "Putar"}
            className="grid size-16 place-items-center bg-accent text-heading text-on-accent hover:bg-accent-hover"
          >
            {playing ? <IconPause /> : <IconPlay />}
          </button>
          <button type="button" onClick={onNext} aria-label="Lagu berikutnya" className="grid size-12 place-items-center text-title hover:bg-raised">
            <IconNext />
          </button>
        </div>

        <div className="mt-auto flex justify-center">
          <button type="button" onClick={onOpenQueue} className="flex items-center gap-2 px-4 py-2 text-body hover:bg-raised">
            <IconQueue className="text-lead" />
            Antrean
          </button>
        </div>
      </div>
    </dialog>
  );
}
