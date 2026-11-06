import { getLikedIds } from "@/lib/data/catalog";
import { LikesHydrator } from "./likes-hydrator";

/** Komponen server: membaca id lagu yang disukai pengguna dan menyerahkannya ke store klien. Dibungkus Suspense di AppShell. */
export async function LikesBootstrap() {
  return <LikesHydrator ids={await getLikedIds()} />;
}
