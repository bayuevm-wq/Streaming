import type { Metadata } from "next";
import { TrackList } from "@/components/media/track-list";
import { EmptyState } from "@/components/ui/empty-state";
import { IconHeart } from "@/components/ui/icons";
import { getLikedTracks } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "Lagu Disukai — Streaming" };

export default async function Page() {
  const tracks = await getLikedTracks();
  return (
    <div className="grid gap-8 px-6 py-8">
      <h1 className="font-display text-display font-medium italic">Lagu Disukai</h1>
      {tracks.length === 0 ? (
        <EmptyState
          icon={<IconHeart />}
          title="Belum ada lagu yang disukai"
          description="Ketuk ikon hati pada sebuah lagu untuk menyimpannya di sini."
        />
      ) : (
        <TrackList tracks={tracks} />
      )}
    </div>
  );
}
