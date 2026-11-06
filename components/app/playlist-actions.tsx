"use client";

import { Button } from "@/components/ui/button";
import { usePlaylistUi } from "@/lib/playlists/ui";

/** Tombol Ganti nama / Hapus pada halaman playlist (membuka dialog global). */
export function PlaylistActions({ id, name }: { id: string; name: string }) {
  return (
    <>
      <Button variant="secondary" size="lg" onClick={() => usePlaylistUi.getState().openRename(id, name)}>
        Ganti nama
      </Button>
      <Button variant="danger" size="lg" onClick={() => usePlaylistUi.getState().openDelete(id, name)}>
        Hapus playlist
      </Button>
    </>
  );
}
