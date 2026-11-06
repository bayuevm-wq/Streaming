"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

type Props = {
  /** Nama untuk pembaca layar, mis. "Posisi lagu" atau "Volume". Wajib: slider tanpa nama tidak bisa dipakai. */
  label: string;
  value: number;
  min?: number;
  max: number;
  step?: number;
  /** Teks yang diumumkan pembaca layar, mis. "1:24 dari 3:42" atau "64%". Bila kosong, angka mentah. */
  valueText?: string;
  /** "ruler" = penggaris bertanda tiap 10% (progres lagu). "line" = garis polos (volume). */
  variant?: "ruler" | "line";
  disabled?: boolean;
  onValueChange?: (value: number) => void;
  className?: string;
};

/**
 * Slider berbasis <input type="range"> asli, jadi semua ini bekerja tanpa kode tambahan:
 * panah kiri/kanan (atau atas/bawah) = ±step, Home/End = ujung, PageUp/PageDown = loncat, dan peran
 * "slider" + aria-valuenow/min/max dibaca pembaca layar. Fokus: cincin kobalt pada pembungkus.
 */
export function Slider({ label, value, min = 0, max, step = 1, valueText, variant = "line", disabled, onValueChange, className }: Props) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div
      className={cn("slider", variant === "ruler" && "slider--ruler", disabled && "opacity-50", className)}
      style={{ "--pct": `${pct}%` } as CSSProperties}
    >
      <input
        type="range"
        aria-label={label}
        aria-valuetext={valueText}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange?.(Number(e.target.value))}
      />
    </div>
  );
}
