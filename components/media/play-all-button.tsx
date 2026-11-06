"use client";

import { Button } from "@/components/ui/button";
import { IconPlay } from "@/components/ui/icons";
import { usePlayer, type Track } from "@/lib/player/store";

/** Memutar seluruh daftar dari lagu pertama. Nonaktif bila daftar kosong. */
export function PlayAllButton({ tracks, label = "Putar semua" }: { tracks: Track[]; label?: string }) {
  const playList = usePlayer((s) => s.playList);
  return (
    <Button size="lg" disabled={tracks.length === 0} onClick={() => void playList(tracks, 0)}>
      <IconPlay />
      {label}
    </Button>
  );
}
