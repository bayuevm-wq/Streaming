import { getPlaylists } from "@/lib/data/playlists";
import { PlaylistsHydrator } from "./playlists-hydrator";

/** Komponen server: membaca playlist pengunjung dan menyerahkannya ke store klien. Dibungkus Suspense di AppShell. */
export async function PlaylistsBootstrap() {
  return <PlaylistsHydrator items={await getPlaylists()} />;
}
