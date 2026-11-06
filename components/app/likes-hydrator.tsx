"use client";

import { useEffect } from "react";
import { installLikesApi } from "@/lib/likes/api";
import { useLikes } from "@/lib/likes/store";

/** Memasang API suka dan mengisi store dari data server. `ids` berasal dari layout (server). */
export function LikesHydrator({ ids }: { ids: string[] }) {
  const key = ids.join(",");
  useEffect(() => {
    installLikesApi();
    useLikes.getState().hydrate(key ? key.split(",") : []);
  }, [key]);
  return null;
}
