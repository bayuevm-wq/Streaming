import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Time } from "./time";
import { IconClose, IconHeart, IconPause, IconPlay, IconPlus } from "./icons";

type Props = {
  /** Nomor urut (mulai 1). Nomor italic besar adalah ciri arah Tinta Cetak; mengecil di layar <= 640px. */
  index: number;
  title: string;
  artist: string;
  album?: string;
  durationSec: number;
  cover: ReactNode;
  playing?: boolean;
  paused?: boolean;
  liked?: boolean;
  onTogglePlay?: () => void;
  onToggleLike?: () => void;
  /** Tampil hanya bila diberikan: "+" membuka dialog Tambahkan ke playlist. */
  onAddToPlaylist?: () => void;
  /** Tampil hanya bila diberikan (halaman playlist): hapus lagu dari playlist ini. */
  onRemove?: () => void;
};

/**
 * Baris lagu. Kolom: nomor/putar | sampul | judul+artis | album | durasi | suka.
 * Di <= 640px kolom album disembunyikan dan nomor dikecilkan (30px -> 20px) agar tak memakan tempat.
 */
export function SongRow({ index, title, artist, album, durationSec, cover, playing, paused, liked, onTogglePlay, onToggleLike, onAddToPlaylist, onRemove }: Props) {
  const showPause = playing && !paused;
  return (
    <div
      aria-current={playing ? "true" : undefined}
      className={cn(
        "group grid items-center gap-4 border-b border-hairline px-2 py-3 hover:bg-surface",
        "grid-cols-[2.75rem_2.75rem_minmax(0,1.6fr)_minmax(0,1fr)_3rem_2.25rem_2.25rem]",
        "phone:grid-cols-[1.5rem_2.5rem_minmax(0,1fr)_2.25rem_2.25rem] phone:gap-2",
        playing && "bg-surface",
      )}
    >
      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={`${showPause ? "Jeda" : "Putar"} ${title}`}
        className={cn(
          "grid h-10 place-items-center text-right font-display text-numeral font-normal italic phone:text-numeral-sm",
          playing ? "text-accent" : "text-muted hover:text-ink",
        )}
      >
        {playing ? (
          <span className="text-lead not-italic">{showPause ? <IconPause /> : <IconPlay />}</span>
        ) : (
          <>
            {/* nomor dekoratif: aria-hidden agar teks tampak tidak "hilang" dari nama aksesibel tombol (WCAG 2.5.3 label in name) */}
            <span aria-hidden="true" className="group-hover:hidden group-focus-within:hidden">
              {index}
            </span>
            <span className="hidden text-lead not-italic group-hover:block group-focus-within:block">
              <IconPlay />
            </span>
          </>
        )}
      </button>
      <div className="size-11 phone:size-10">{cover}</div>
      <div className="min-w-0">
        <p className={cn("truncate font-display text-title font-medium phone:text-body", playing ? "text-accent" : "text-ink")}>{title}</p>
        <p className="truncate text-small text-muted">{artist}</p>
      </div>
      <p className="truncate text-small text-muted phone:hidden">{album ?? ""}</p>
      <p className="text-right text-small text-muted phone:hidden"><Time seconds={durationSec} /></p>
      <button
        type="button"
        onClick={onToggleLike}
        aria-pressed={Boolean(liked)}
        aria-label={`${liked ? "Batal suka" : "Sukai"} ${title}`}
        className={cn("grid size-9 place-items-center text-lead", liked ? "text-accent" : "text-muted hover:text-ink")}
      >
        <IconHeart filled={liked} />
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Hapus ${title} dari playlist`}
          className="grid size-9 place-items-center text-lead text-muted hover:text-error"
        >
          <IconClose />
        </button>
      ) : onAddToPlaylist ? (
        <button
          type="button"
          onClick={onAddToPlaylist}
          aria-label={`Tambahkan ${title} ke playlist`}
          className="grid size-9 place-items-center text-lead text-muted hover:text-ink"
        >
          <IconPlus />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}
