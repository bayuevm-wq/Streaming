"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";

/** Sidebar dengan item aktif dari jalur saat ini. Daftar playlist diisi pada Fase 3. */
export function AppSidebar() {
  const pathname = usePathname();
  return <Sidebar current={pathname} playlists={[]} />;
}
