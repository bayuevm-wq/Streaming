"use client";

import { Button } from "@/components/ui/button";
import { Cover } from "@/components/ui/cover";
import { Dialog } from "@/components/ui/dialog";
import { Time } from "@/components/ui/time";
import { cn } from "@/lib/cn";
import { usePlayer } from "@/lib/player/store";

/** Panel antrean: lagu yang sedang diputar dan berikutnya. Mengeklik lagu memutarnya (spec F2). */
export function QueueDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const playIndex = usePlayer((s) => s.playIndex);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Antrean"
      description={queue.length ? `${queue.length} lagu` : "Antrean kosong."}
      actions={
        <Button variant="secondary" onClick={onClose}>
          Tutup
        </Button>
      }
    >
      <ol className="grid max-h-[50vh] overflow-y-auto border-t border-hairline">
        {queue.map((t, i) => (
          <li key={`${t.id}-${i}`} className="border-b border-hairline">
            <button
              type="button"
              onClick={() => void playIndex(i)}
              aria-current={i === index ? "true" : undefined}
              className={cn("grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-2 py-2 text-left hover:bg-raised", i === index && "bg-raised")}
            >
              <span className="size-10">
                <Cover src={t.coverUrl} />
              </span>
              <span className="min-w-0">
                <span className={cn("block truncate font-display text-body font-medium", i === index ? "text-accent" : "text-ink")}>{t.title}</span>
                <span className="block truncate text-small text-muted">{i === index ? "Sedang diputar · " : ""}{t.artist}</span>
              </span>
              <span className="text-small text-muted">
                <Time seconds={t.durationSec} />
              </span>
            </button>
          </li>
        ))}
      </ol>
    </Dialog>
  );
}
