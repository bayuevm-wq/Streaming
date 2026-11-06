"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconClose } from "./icons";
import { StatusMessage, type StatusKind } from "./status";

type Props = {
  kind: StatusKind;
  title?: string;
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  className?: string;
};

/**
 * Toast: StatusMessage (ikon + judul + teks) yang melayang, dengan tombol tutup dan aksi opsional ("Urungkan").
 * Toast galat memakai role="alert"; yang lain role="status" (sopan, tidak memotong pembaca layar).
 * Jangan menutup otomatis toast yang berisi aksi atau galat; beri waktu >= 6 detik untuk yang lain.
 */
export function Toast({ kind, title, children, actionLabel, onAction, onDismiss, className }: Props) {
  return (
    <div className={cn("relative w-full max-w-sm shadow-float", className)}>
      <StatusMessage kind={kind} title={title} className="pr-12">
        {children}
        {actionLabel ? (
          <button type="button" onClick={onAction} className="mt-2 block font-semibold text-accent underline underline-offset-4 hover:text-accent-hover">
            {actionLabel}
          </button>
        ) : null}
      </StatusMessage>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} aria-label="Tutup pesan" className="absolute top-1.5 right-1.5 grid size-8 place-items-center text-lead text-ink hover:bg-raised">
          <IconClose />
        </button>
      ) : null}
    </div>
  );
}

/** Wadah toast: ditaruh sekali di layout. `aria-live` agar toast yang muncul diumumkan. */
export function ToastRegion({ children }: { children: ReactNode }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-24 z-50 grid gap-3 *:pointer-events-auto">
      {children}
    </div>
  );
}
