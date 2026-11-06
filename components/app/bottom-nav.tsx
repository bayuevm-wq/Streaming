"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/ui/bottom-nav";

/** Navigasi bawah dengan item aktif dari jalur saat ini. Hanya tampil di <= 760px (kelas dari pemanggil). */
export function AppBottomNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return <BottomNav current={pathname} className={className} />;
}
