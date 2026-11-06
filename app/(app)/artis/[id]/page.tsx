import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayAllButton } from "@/components/media/play-all-button";
import { CARD_GRID, Section } from "@/components/media/section";
import { TrackList } from "@/components/media/track-list";
import { Cover } from "@/components/ui/cover";
import { MediaCard } from "@/components/ui/media-card";
import { getArtist } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "Artis — Streaming" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getArtist(id);
  if (!data) notFound();
  const { artist, albums, tracks } = data;

  return (
    <div className="grid gap-10 px-6 py-8">
      <header className="grid items-end gap-6 sm:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="w-44 sm:w-56">
          <Cover src={artist.imageUrl} priority />
        </div>
        <div className="grid gap-3">
          <p className="text-small text-muted">Artis</p>
          <h1 className="font-display text-display font-medium italic text-balance">{artist.name}</h1>
          <p className="text-body text-muted">
            {albums.length} album · {tracks.length} lagu
          </p>
          <div>
            <PlayAllButton tracks={tracks} />
          </div>
        </div>
      </header>

      {albums.length > 0 && (
        <Section id="album" title="Album">
          <div className={CARD_GRID}>
            {albums.map((a) => (
              <MediaCard
                key={a.id}
                kind="album"
                title={a.title}
                subtitle={a.year ? String(a.year) : "Album"}
                cover={<Cover src={a.coverUrl} />}
                href={`/album/${a.id}`}
              />
            ))}
          </div>
        </Section>
      )}
      {tracks.length > 0 && (
        <Section id="lagu" title="Lagu">
          <TrackList tracks={tracks} />
        </Section>
      )}
    </div>
  );
}
