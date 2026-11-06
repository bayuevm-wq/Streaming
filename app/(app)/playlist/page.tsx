import type { Metadata } from "next";
import { PlaylistIndex } from "@/components/app/playlist-index";
import { getPlaylists } from "@/lib/data/playlists";

export const metadata: Metadata = { title: "Playlist — Streaming" };

export default async function Page() {
  const initial = await getPlaylists();
  return (
    <div className="grid gap-8 px-6 py-8">
      <h1 className="font-display text-display font-medium italic">Playlist</h1>
      <PlaylistIndex initial={initial} />
    </div>
  );
}
