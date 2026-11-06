"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { InlineStatus } from "./status";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  hint?: ReactNode;
  /** Pesan galat: tampil dengan ikon + teks dan dihubungkan lewat aria-describedby. */
  error?: ReactNode;
  id?: string;
};

/** Kolom isian dengan label tampak, petunjuk, dan galat. Batas kontrol 3:1 (token `control`). */
export function TextField({ label, hint, error, id, className, ...rest }: Props) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("grid gap-2", className)}>
      <label htmlFor={inputId} className="text-small font-semibold text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-10 w-full border bg-surface px-3 text-body text-ink placeholder:text-muted disabled:opacity-50",
          error ? "border-error" : "border-control hover:border-ink",
        )}
        {...rest}
      />
      {hint ? (
        <p id={hintId} className="text-small text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <InlineStatus id={errorId} kind="error">
          {error}
        </InlineStatus>
      ) : null}
    </div>
  );
}
