import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconError, IconSuccess, IconWarning } from "./icons";

export type StatusKind = "success" | "warning" | "error";

// Peta kelas ditulis utuh agar Tailwind dapat menemukannya saat build.
const META = {
  success: { Icon: IconSuccess, label: "Berhasil", box: "border-success bg-success-surface", tone: "text-success", role: "status" },
  warning: { Icon: IconWarning, label: "Perhatian", box: "border-warning bg-warning-surface", tone: "text-warning", role: "status" },
  error: { Icon: IconError, label: "Gagal", box: "border-error bg-error-surface", tone: "text-error", role: "alert" },
} as const;

type Props = {
  kind: StatusKind;
  /** Judul pendek. Bawaan: "Berhasil" / "Perhatian" / "Gagal". Teks selalu ada, jadi status tak hanya berupa warna. */
  title?: string;
  children: ReactNode;
  className?: string;
};

/** Pesan status: SELALU ikon + judul + teks. Warna hanya penguat. */
export function StatusMessage({ kind, title, children, className }: Props) {
  const m = META[kind];
  return (
    <div role={m.role} className={cn("flex items-start gap-3 border-t-2 p-3", m.box, className)}>
      <m.Icon className={cn("mt-0.5 shrink-0 text-lead", m.tone)} />
      <div className="min-w-0">
        <p className={cn("text-small font-semibold", m.tone)}>{title ?? m.label}</p>
        <p className="text-small text-ink">{children}</p>
      </div>
    </div>
  );
}

/** Versi satu baris untuk galat di bawah kolom isian: ikon + teks, tanpa kotak. */
export function InlineStatus({ kind, children, id, className }: { kind: StatusKind; children: ReactNode; id?: string; className?: string }) {
  const m = META[kind];
  return (
    <p id={id} role={m.role} className={cn("flex items-start gap-2 text-small text-ink", className)}>
      <m.Icon className={cn("mt-0.5 shrink-0 text-body", m.tone)} />
      <span>
        <span className={cn("font-semibold", m.tone)}>{m.label}: </span>
        {children}
      </span>
    </p>
  );
}
