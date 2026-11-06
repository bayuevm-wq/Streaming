import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconPlay } from "./icons";

type Props = {
  kind: "album" | "artist";
  title: string;
  /** Album: "Nama Artis · 2024". Artis: "Artis" atau jumlah lagu. */
  subtitle: string;
  cover: ReactNode;
  href: string;
  /** Hanya untuk album: memutar seluruh isi album. */
  onPlay?: () => void;
};

/** Kartu album atau artis. Seluruh kartu adalah satu tautan; album punya tombol putar terpisah. */
export function MediaCard({ kind, title, subtitle, cover, href, onPlay }: Props) {
  return (
    <article className="group relative grid gap-3">
      <div className="relative">
        {cover}
        {kind === "album" && onPlay ? (
          <button
            type="button"
            onClick={onPlay}
            aria-label={`Putar album ${title}`}
            className={cn(
              "absolute right-0 bottom-0 z-10 grid size-10 place-items-center bg-accent text-lead text-on-accent transition-opacity duration-(--duration-base) hover:bg-accent-hover",
              "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100",
            )}
          >
            <IconPlay />
          </button>
        ) : null}
      </div>
      <div className="min-w-0 border-t border-hairline pt-2.5">
        <h3 className="truncate font-display text-title font-medium">
          {/* tautan menutupi seluruh kartu lewat ::after, tombol putar tetap di atasnya (z-10) */}
          <Link href={href} className="after:absolute after:inset-0 hover:underline">
            {title}
          </Link>
        </h3>
        <p className="truncate text-small text-muted">{subtitle}</p>
      </div>
    </article>
  );
}
