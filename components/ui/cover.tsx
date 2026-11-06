import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconMusic } from "./icons";

type Props = {
  /** URL sampul (Storage). Tanpa `src` dan `children`, tampil placeholder konsisten (nada `raised` + ikon nada). */
  src?: string | null;
  /** Kosongkan (bawaan) bila judul lagu sudah ada di sebelahnya; isi bila sampul berdiri sendiri. */
  alt?: string;
  /** Pengganti gambar, mis. SVG contoh di halaman /gaya. */
  children?: ReactNode;
  className?: string;
};

/** Sampul persegi, sudut tajam. Semua sampul memakai rasio 1:1 dan penanganan yang sama. */
export function Cover({ src, alt = "", children, className }: Props) {
  return (
    <div className={cn("relative aspect-square w-full overflow-hidden bg-raised text-muted", className)}>
      {children ? (
        <div className="size-full [&>svg]:block [&>svg]:size-full" role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
          {children}
        </div>
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage; next/image dikonfigurasi saat Fase 2
        <img src={src} alt={alt} loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <div className="grid size-full place-items-center text-heading" role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
          <IconMusic />
        </div>
      )}
    </div>
  );
}
