import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconPause, IconPlay } from "./icons";

type Props = {
  title: string;
  artist: string;
  cover: ReactNode;
  /** Tautan ke halaman lagu/album. Tanpa href, judul berupa teks biasa. */
  href?: string;
  playing?: boolean;
  /** Menandai bahwa audio benar-benar berjalan (indikator bergerak). Jeda = batang diam. */
  paused?: boolean;
  onTogglePlay?: () => void;
};

/**
 * Kartu lagu. Tombol putar adalah <button> sungguhan: muncul saat hover/fokus, selalu tampak pada perangkat sentuh
 * dan pada lagu yang sedang aktif. Lagu aktif ditandai garis aksen di atas judul + teks aksen + label (bukan warna saja).
 */
export function SongCard({ title, artist, cover, href, playing, paused, onTogglePlay }: Props) {
  const showPause = playing && !paused;
  return (
    <article className="group relative grid gap-3" aria-current={playing ? "true" : undefined}>
      <div className="relative">
        {cover}
        {playing ? (
          <span className="absolute top-0 left-0 inline-flex items-center gap-2 bg-ground px-2.5 py-1.5 text-caption font-semibold text-accent">
            <span className="eq" data-paused={paused ? "true" : "false"} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {paused ? "Dijeda" : "Sedang diputar"}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={`${showPause ? "Jeda" : "Putar"} ${title}`}
          className={cn(
            "absolute right-0 bottom-0 grid size-10 place-items-center bg-accent text-lead text-on-accent transition-opacity duration-(--duration-base) hover:bg-accent-hover",
            "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100",
            playing && "opacity-100",
          )}
        >
          {showPause ? <IconPause /> : <IconPlay />}
        </button>
      </div>
      <div className={cn("min-w-0 pt-2.5", playing ? "border-t-[3px] border-accent pt-2" : "border-t border-hairline")}>
        <h3 className={cn("truncate font-display text-title font-medium", playing ? "text-accent" : "text-ink")}>
          {href ? (
            <Link href={href} className="hover:underline">
              {title}
            </Link>
          ) : (
            title
          )}
        </h3>
        <p className="truncate text-small text-muted">{artist}</p>
      </div>
    </article>
  );
}
