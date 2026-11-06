"use client";

import { useEffect } from "react";
import { initPlayer } from "@/lib/player/store";

/** Memasang pendengar event pada elemen audio singleton, sekali. Berada di layout (app), jadi tidak ikut unmount saat navigasi. */
export function PlayerBoot() {
  useEffect(() => {
    initPlayer();
  }, []);
  return null;
}
