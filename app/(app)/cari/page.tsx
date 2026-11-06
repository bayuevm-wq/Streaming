import type { Metadata } from "next";
import { TrackList } from "@/components/media/track-list";
import { CARD_GRID, Section } from "@/components/media/section";
import { Cover } from "@/components/ui/cover";
import { EmptyState } from "@/components/ui/empty-state";
import { IconSearch } from "@/components/ui/icons";
import { MediaCard } from "@/components/ui/media-card";
import { normalizeQuery, searchAll } from "@/lib/data/search";

export const metadata: Metadata = { title: "Pencarian — Streaming" };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const q = normalizeQuery((await searchParams).q);

  if (!q) {
    return (
      <div className="grid gap-8 px-6 py-8">
        <h1 className="font-display text-display font-medium italic">Pencarian</h1>
        <EmptyState icon={<IconSearch />} title="Cari musik" description="Ketik judul lagu, nama album, atau nama artis di kolom pencarian di atas." />
      </div>
    );
  }

  const { tracks, albums, artists } = await searchAll(q);
  const none = tracks.length === 0 && albums.length === 0 && artists.length === 0;

  return (
    <div className="grid gap-10 px-6 py-8">
      <h1 className="font-display text-display font-medium italic text-balance">
        Hasil untuk “{q}”
      </h1>
      {none ? (
        <EmptyState
          icon={<IconSearch />}
          title={`Tidak ada hasil untuk “${q}”`}
          description="Coba kata kunci yang lebih pendek, periksa ejaan, atau cari nama artis atau album."
        />
      ) : (
        <>
          {tracks.length > 0 && (
            <Section id="lagu" title="Lagu">
              <TrackList tracks={tracks} />
            </Section>
          )}
          {albums.length > 0 && (
            <Section id="album" title="Album">
              <div className={CARD_GRID}>
                {albums.map((a) => (
                  <MediaCard key={a.id} kind="album" title={a.title} subtitle={a.artistName} cover={<Cover src={a.coverUrl} />} href={`/album/${a.id}`} />
                ))}
              </div>
            </Section>
          )}
          {artists.length > 0 && (
            <Section id="artis" title="Artis">
              <div className={CARD_GRID}>
                {artists.map((a) => (
                  <MediaCard key={a.id} kind="artist" title={a.name} subtitle="Artis" cover={<Cover src={a.imageUrl} />} href={`/artis/${a.id}`} />
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
