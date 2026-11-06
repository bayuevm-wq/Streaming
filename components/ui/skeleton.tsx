import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Blok placeholder. Berdenyut pelan (opacity saja); mode "kurangi gerakan" mematikannya lewat aturan global. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-[skeleton_1.6s_ease-in-out_infinite] bg-raised", className)} />;
}

/** Bungkus kelompok skeleton agar pembaca layar mendengar "Memuat" sekali, bukan tiap blok. */
export function SkeletonGroup({ children, label = "Memuat" }: { children: ReactNode; label?: string }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  );
}

export function SongCardSkeleton() {
  return (
    <div className="grid gap-3" aria-hidden="true">
      <Skeleton className="aspect-square w-full" />
      <div className="grid gap-2 border-t border-hairline pt-2.5">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

export function SongRowSkeleton() {
  return (
    <div className="grid grid-cols-[2.75rem_2.75rem_1fr_3rem] items-center gap-4 border-b border-hairline px-2 py-3" aria-hidden="true">
      <Skeleton className="mx-auto h-6 w-6" />
      <Skeleton className="size-11" />
      <div className="grid gap-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <Skeleton className="h-4 w-10" />
    </div>
  );
}
