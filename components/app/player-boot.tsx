"use client";

import { useEffect } from "react";
import { installPrivateAudio } from "@/lib/player/private-audio";
import { initPlayer } from "@/lib/player/store";

/** Memasang pendengar event pada elemen audio singleton dan resolver lagu pribadi, sekali. Berada di layout (app), jadi tidak ikut unmount saat navigasi. */
export function PlayerBoot() {
  useEffect(() => {
    initPlayer();
    installPrivateAudio();
  }, []);
  return null;
}
