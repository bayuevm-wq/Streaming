"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import { usePlaylists } from "@/lib/playlists/store";
import { usePlaylistUi } from "@/lib/playlists/ui";

/** Sidebar dengan item aktif dari jalur saat ini dan daftar playlist pengunjung. */
export function AppSidebar() {
  const pathname = usePathname();
  const items = usePlaylists((s) => s.items);
  const hydrated = usePlaylists((s) => s.hydrated);
  return <Sidebar current={pathname} playlists={items} loading={!hydrated} onCreatePlaylist={() => usePlaylistUi.getState().openCreate()} />;
}
