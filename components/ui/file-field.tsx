"use client";

import { useId, type ReactNode } from "react";
import { buttonClasses } from "./button";
import { Button } from "./button";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/cn";

type Props = {
  /** Judul bidang (tampak), mis. "Berkas MP3 (maks 10 MB)". */
  title: string;
  /** Label tombol saat belum ada berkas, mis. "Pilih berkas MP3". */
  pickLabel: string;
  /** Label tombol saat sudah ada berkas, mis. "Ganti berkas MP3". */
  changeLabel: string;
  accept: string;
  file: { name: string; size: number } | null;
  onChange: (file: File | null) => void;
  /** Teks di samping tombol bila belum ada berkas. */
  emptyText?: string;
  hint?: ReactNode;
  error?: string | null;
  disabled?: boolean;
  id?: string;
  className?: string;
};

/**
 * Pemilih berkas bergaya design system. Input `type="file"` ASLI tetap ada (disembunyikan secara visual, bukan `display:none`),
 * sehingga bisa difokus dengan Tab, dibuka dengan Enter/Spasi, dan dibaca pembaca layar. Tombolnya adalah `<label>` yang
 * terhubung ke input itu. Nama berkas terpilih dan tombol "Hapus pilihan" tampil di sampingnya; fokus keyboard pada input
 * menggambar cincin fokus pada tombol.
 */
export function FileField({ title, pickLabel, changeLabel, accept, file, onChange, emptyText = "Belum ada berkas dipilih", hint, error, disabled, id, className }: Props) {
  const auto = useId();
  const inputId = id ?? auto;
  const titleId = `${inputId}-title`;
  const nameId = `${inputId}-name`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [file ? nameId : null, hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div role="group" aria-labelledby={titleId} className={cn("grid gap-2", className)}>
      <p id={titleId} className="text-small font-semibold text-ink">
        {title}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <input
          id={inputId}
          type="file"
          accept={accept}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className="peer sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = ""; // memilih berkas yang sama lagi tetap memicu onChange
            if (f) onChange(f);
          }}
        />
        <label
          htmlFor={inputId}
          className={cn(
            buttonClasses({ variant: "secondary", size: "md" }),
            "cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[3px] peer-focus-visible:outline-accent peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
          )}
        >
          {file ? changeLabel : pickLabel}
        </label>
        {file ? (
          <>
            <span id={nameId} className="min-w-0 text-body text-ink [overflow-wrap:anywhere]" data-testid={`${inputId}-name`}>
              {file.name} <span className="text-small whitespace-nowrap text-muted">({formatFileSize(file.size)})</span>
            </span>
            <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(null)} aria-label={`Hapus pilihan: ${file.name}`}>
              Hapus pilihan
            </Button>
          </>
        ) : (
          <span className="text-body text-muted">{emptyText}</span>
        )}
      </div>
      {hint ? (
        <p id={hintId} className="text-small text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-small text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
