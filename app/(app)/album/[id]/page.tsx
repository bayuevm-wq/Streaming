import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayAllButton } from "@/components/media/play-all-button";
import { TrackList } from "@/components/media/track-list";
import { Cover } from "@/components/ui/cover";
import { EmptyState } from "@/components/ui/empty-state";
import { IconMusic } from "@/components/ui/icons";
import { getAlbum } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "Album — Streaming" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getAlbum(id);
  if (!data) notFound();
  const { album, tracks } = data;
  const minutes = Math.max(1, Math.round(tracks.reduce((n, t) => n + t.durationSec, 0) / 60));

  return (
    <div className="grid gap-8 px-6 py-8">
      <header className="grid items-end gap-6 sm:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="w-44 sm:w-56">
          <Cover src={album.coverUrl} />
        </div>
        <div className="grid gap-3">
          <p className="text-small text-muted">Album</p>
          <h1 className="font-display text-display font-medium italic text-balance">{album.title}</h1>
          <p className="text-body text-muted">
            <Link href={`/artis/${album.artistId}`} className="font-semibold text-ink hover:underline">
              {album.artistName}
            </Link>
            {album.year ? ` · ${album.year}` : ""} · {tracks.length} lagu{tracks.length ? ` · ${minutes} menit` : ""}
          </p>
          <div>
            <PlayAllButton tracks={tracks} label="Putar album" />
          </div>
        </div>
      </header>
      {tracks.length > 0 ? (
        <TrackList tracks={tracks} />
      ) : (
        <EmptyState icon={<IconMusic />} title="Album ini belum punya lagu" description="Lagu akan muncul di sini setelah ditambahkan ke katalog." />
      )}
    </div>
  );
}
