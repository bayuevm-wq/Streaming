"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Cover } from "@/components/ui/cover";
import { Dialog } from "@/components/ui/dialog";
import { SongRow } from "@/components/ui/song-row";
import type { PrivateTrack } from "@/lib/data/library";
import { useLikes } from "@/lib/likes/store";
import { installPrivateAudio } from "@/lib/player/private-audio";
import { prefetchPrivateUrl } from "@/lib/player/private-url";
import { usePlayer } from "@/lib/player/store";
import { usePlaylistUi } from "@/lib/playlists/ui";
import { deleteSong } from "@/lib/uploads/client";
import { formatTimeLeft } from "@/lib/uploads/rules";
import { useToasts } from "@/lib/ui/toasts";

/** Sisa waktu hidup satu lagu; diperbarui tiap 30 detik. */
function TimeLeft({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return <span data-testid="time-left">{formatTimeLeft(new Date(expiresAt).getTime() - now)}</span>;
}

/**
 * Daftar lagu pribadi. Signed URL dipra-ambil begitu baris tampil (fallback Safari, S4), sehingga mengetuk putar memanggil
 * `play()` sinkron dari cache. Tiap baris menampilkan sisa waktu dan tombol Hapus (dengan konfirmasi).
 */
export function LibraryList({ tracks }: { tracks: PrivateTrack[] }) {
  const router = useRouter();
  const currentId = usePlayer((s) => s.queue[s.index]?.id ?? null);
  const status = usePlayer((s) => s.status);
  const playList = usePlayer((s) => s.playList);
  const toggle = usePlayer((s) => s.toggle);
  const likedIds = useLikes((s) => s.ids);
  const [target, setTarget] = useState<PrivateTrack | null>(null);
  const [busy, setBusy] = useState(false);

  const key = tracks.map((t) => t.id).join(",");
  useEffect(() => {
    installPrivateAudio();
    for (const id of key ? key.split(",") : []) void prefetchPrivateUrl(id);
  }, [key]);

  async function confirmDelete() {
    if (!target || busy) return;
    setBusy(true);
    const ok = await deleteSong(target.id);
    setBusy(false);
    if (!ok) {
      useToasts.getState().push("error", "Gagal menghapus lagu. Periksa koneksi lalu coba lagi.");
      return;
    }
    useToasts.getState().push("success", `“${target.title}” dihapus. Slot lagu dibebaskan.`);
    setTarget(null);
    router.refresh();
  }

  return (
    <>
      <div className="border-t border-hairline">
        {tracks.map((t, i) => {
          const current = currentId === t.id && status !== "idle";
          return (
            <div key={t.id} className="border-b border-hairline">
              <div className="[&>div]:border-b-0">
                <SongRow
                  index={i + 1}
                  title={t.title}
                  artist={t.artist}
                  album={t.album ?? undefined}
                  durationSec={t.durationSec}
                  cover={<Cover src={t.coverUrl} />}
                  playing={current}
                  paused={current && status !== "playing" && status !== "loading"}
                  liked={likedIds.has(t.id)}
                  onToggleLike={() => void useLikes.getState().toggle(t.id)}
                  onTogglePlay={() => (current ? toggle() : void playList(tracks, i))}
                  onAddToPlaylist={() => usePlaylistUi.getState().openAdd(t.id, t.title)}
                />
              </div>
              <div className="flex items-center justify-between gap-3 px-2 pb-3 pl-[4.5rem] text-small text-muted phone:pl-12">
                <span>
                  Terhapus otomatis dalam <TimeLeft expiresAt={t.expiresAt} />
                </span>
                <Button variant="ghost" size="sm" onClick={() => setTarget(t)} aria-label={`Hapus ${t.title}`}>
                  Hapus
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <Dialog
        open={target !== null}
        onClose={() => setTarget(null)}
        title="Hapus lagu ini?"
        description={target ? `“${target.title}” dihapus permanen dari library, beserta like dan posisinya di playlist.` : undefined}
        actions={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Batal
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()} disabled={busy}>
              Hapus lagu
            </Button>
          </>
        }
      />
    </>
  );
}
