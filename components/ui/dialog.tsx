"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Tombol aksi (Batal, Konfirmasi). Letakkan aksi paling aman di awal agar menerima fokus awal bila perlu. */
  actions: ReactNode;
  className?: string;
};

/**
 * Dialog modal di atas <dialog> asli: fokus terkunci di dalam, Esc menutup, latar di belakang tak bisa dioperasikan,
 * dan fokus kembali ke pemicu saat ditutup. Klik pada scrim juga menutup.
 */
export function Dialog({ open, onClose, title, description, children, actions, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // klik pada scrim (area di luar kotak)
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-md border border-hairline bg-surface p-6 text-ink shadow-float backdrop:bg-scrim",
        className,
      )}
    >
      <h2 id={titleId} className="font-display text-heading font-medium">
        {title}
      </h2>
      {description ? (
        <p id={descId} className="mt-2 text-body text-muted">
          {description}
        </p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
      <div className="mt-6 flex flex-wrap justify-end gap-3">{actions}</div>
    </dialog>
  );
}
