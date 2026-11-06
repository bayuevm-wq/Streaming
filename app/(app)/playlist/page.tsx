import type { Metadata } from "next";
import { PlaylistIndex } from "@/components/app/playlist-index";

export const metadata: Metadata = { title: "Playlist — Streaming" };

export default function Page() {
  return (
    <div className="grid gap-8 px-6 py-8">
      <h1 className="font-display text-display font-medium italic">Playlist</h1>
      <PlaylistIndex />
    </div>
  );
}
