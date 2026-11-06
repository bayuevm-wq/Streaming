import type { Metadata } from "next";
import { SongCardGrid } from "@/components/media/song-card-grid";
import { CARD_GRID, Section } from "@/components/media/section";
import { ButtonLink } from "@/components/ui/button-link";
import { Cover } from "@/components/ui/cover";
import { EmptyState } from "@/components/ui/empty-state";
import { IconMusic } from "@/components/ui/icons";
import { MediaCard } from "@/components/ui/media-card";
import { getHome } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "Beranda — Streaming" };

export default async function Page() {
  const { songs, albums, artists } = await getHome();
  const empty = songs.length === 0 && albums.length === 0 && artists.length === 0;

  return (
    <div className="grid gap-12 px-6 py-8">
      <h1 className="font-display text-display font-medium italic">Beranda</h1>
      {empty ? (
        <EmptyState
          icon={<IconMusic />}
          title="Katalog masih kosong"
          description="Belum ada lagu di katalog. Kamu tetap bisa mengunggah MP3 ke library pribadimu (maks 3 lagu, terhapus otomatis dalam 24 jam)."
          action={<ButtonLink href="/unggah">Unggah lagu</ButtonLink>}
        />
      ) : (
        <>
          {songs.length > 0 && (
            <Section id="lagu-terbaru" title="Lagu Terbaru">
              <SongCardGrid tracks={songs} />
            </Section>
          )}
          {albums.length > 0 && (
            <Section id="album" title="Album">
              <div className={CARD_GRID}>
                {albums.map((a) => (
                  <MediaCard
                    key={a.id}
                    kind="album"
                    title={a.title}
                    subtitle={a.year ? `${a.artistName} · ${a.year}` : a.artistName}
                    cover={<Cover src={a.coverUrl} />}
                    href={`/album/${a.id}`}
                  />
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
