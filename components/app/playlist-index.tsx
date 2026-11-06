"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconPlaylist, IconPlus } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { MAX_PLAYLISTS } from "@/lib/playlists/rules";
import { usePlaylists } from "@/lib/playlists/store";
import { usePlaylistUi } from "@/lib/playlists/ui";

/** Daftar playlist (halaman /playlist; juga jalur masuk di ponsel). Membaca store agar langsung mutakhir. */
export function PlaylistIndex() {
  const items = usePlaylists((s) => s.items);
  const hydrated = usePlaylists((s) => s.hydrated);
  const create = () => usePlaylistUi.getState().openCreate();

  if (!hydrated) return <Skeleton className="h-32 w-full" />;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<IconPlaylist />}
        title="Belum ada playlist"
        description="Kumpulkan lagu favoritmu dalam playlist. Buat yang pertama, lalu tambahkan lagu dengan tombol + di tiap baris."
        action={
          <Button onClick={create}>
            <IconPlus />
            Buat playlist
          </Button>
        }
      />
    );
  }
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-body text-muted">
          {items.length} dari {MAX_PLAYLISTS} playlist
        </p>
        <Button onClick={create} disabled={items.length >= MAX_PLAYLISTS}>
          <IconPlus />
          Buat playlist
        </Button>
      </div>
      <ul className="border-t border-hairline">
        {items.map((p) => (
          <li key={p.id} className="border-b border-hairline">
            <Link href={`/playlist/${p.id}`} className="flex items-center gap-4 px-2 py-3 hover:bg-surface">
              <IconPlaylist className="text-title text-muted" />
              <span className="min-w-0 flex-1 truncate font-display text-title font-medium">{p.name}</span>
              <span className="text-small text-muted">{p.count} lagu</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
