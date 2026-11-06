"use client";

import { useEffect } from "react";
import { usePlaylists, type PlaylistSummary } from "@/lib/playlists/store";

export function PlaylistsHydrator({ items }: { items: PlaylistSummary[] }) {
  const key = JSON.stringify(items);
  useEffect(() => {
    usePlaylists.getState().hydrate(JSON.parse(key) as PlaylistSummary[]);
  }, [key]);
  return null;
}
