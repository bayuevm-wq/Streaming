import { Fragment } from "react";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";

/**
 * Waktu "3:42" dengan angka tabular (lebar sama, kolom rata) TETAPI titik dua proporsional.
 * Di Schibsted Grotesk, `tabular-nums` ikut melebarkan titik dua dari 3,9px menjadi 8,9px (pada 14px), sehingga tampak
 * "3 : 42". Dengan titik dua proporsional, "d:dd" tetap selebar sama (30,6px) dan celahnya rapat.
 * Teks yang dibaca pembaca layar tetap "3:42".
 */
export function Time({ seconds, className }: { seconds: number; className?: string }) {
  const parts = formatTime(seconds).split(":");
  return (
    <span className={cn("tabular-nums", className)}>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 ? <span className="colon">:</span> : null}
          {p}
        </Fragment>
      ))}
    </span>
  );
}
