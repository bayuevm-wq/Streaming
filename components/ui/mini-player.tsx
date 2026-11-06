import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconNext, IconPause, IconPlay } from "./icons";

type Props = {
  track: { title: string; artist: string; cover: ReactNode };
  playing: boolean;
  /** Garis progres tipis di tepi atas (tidak interaktif; geser posisi ada di pemutar penuh). Diberikan sebagai slot agar
   * hanya komponen kecil itu yang berlangganan posisi (4x/detik), bukan seluruh pemutar. */
  progress?: ReactNode;
  onTogglePlay: () => void;
  onNext: () => void;
  /** Membuka pemutar penuh (FullPlayer). */
  onOpen: () => void;
  className?: string;
};

/**
 * Mini-player untuk layar <= 760px: satu baris setinggi ~58px (sampul 40px + judul/artis + putar/jeda + berikutnya).
 * Mengetuk area lagu membuka pemutar penuh. Progres hanya garis 2px di tepi atas (dekoratif, aria-hidden).
 */
export function MiniPlayer({ track, playing, progress, onTogglePlay, onNext, onOpen, className }: Props) {
  return (
    <section aria-label="Pemutar musik" className={cn("relative border-t border-hairline bg-surface", className)}>
      <p className="sr-only" aria-live="polite">
        {playing ? "Sedang diputar" : "Dijeda"}: {track.title}, {track.artist}
      </p>
      {progress}
      <div className="flex items-center pr-1">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Buka pemutar: ${track.title}, ${track.artist}`}
          className="flex min-w-0 flex-1 items-center gap-3 p-2 text-left"
        >
          <span className="size-10 shrink-0">{track.cover}</span>
          <span className="min-w-0">
            <span className="block truncate font-display text-body leading-tight font-medium italic">{track.title}</span>{" "}
            <span className="block truncate text-small text-muted">{track.artist}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? "Jeda" : "Putar"}
          className="grid size-11 shrink-0 place-items-center bg-accent text-lead text-on-accent hover:bg-accent-hover"
        >
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <button type="button" onClick={onNext} aria-label="Lagu berikutnya" className="grid size-11 shrink-0 place-items-center text-lead text-ink hover:bg-raised">
          <IconNext />
        </button>
      </div>
    </section>
  );
}
