import type { Metadata } from "next";
import { LibraryList } from "@/components/app/library-list";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { IconLibrary, IconPlus } from "@/components/ui/icons";
import { getMyLibrary, getUploadStatus } from "@/lib/data/library";
import { TTL_HOURS } from "@/lib/uploads/rules";

export const metadata: Metadata = { title: "Library — Streaming" };

export default async function Page() {
  const [tracks, status] = await Promise.all([getMyLibrary(), getUploadStatus()]);
  const full = status.active >= status.max;
  return (
    <div className="grid gap-8 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <h1 className="font-display text-display font-medium italic">Library</h1>
          <p className="text-body text-muted">
            Slot terpakai: <strong data-testid="slots" className="font-semibold text-ink">{status.active}/{status.max}</strong>. Lagu pribadi terhapus otomatis setelah {TTL_HOURS} jam.
          </p>
        </div>
        <ButtonLink href="/unggah" size="lg">
          <IconPlus />
          {full ? "Slot penuh" : "Unggah lagu"}
        </ButtonLink>
      </header>
      {tracks.length === 0 ? (
        <EmptyState
          icon={<IconLibrary />}
          title="Library kamu masih kosong"
          description="Unggah MP3 milikmu sendiri untuk dicoba di sini. Hanya kamu yang bisa melihat dan memutarnya, dan lagunya terhapus otomatis setelah 24 jam."
          action={<ButtonLink href="/unggah">Unggah lagu</ButtonLink>}
        />
      ) : (
        <LibraryList tracks={tracks} />
      )}
    </div>
  );
}
