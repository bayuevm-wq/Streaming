import { createClient } from "@/lib/supabase/client";
import { setLikesApi } from "./store";

/**
 * Menyambungkan store suka ke Supabase lewat klien browser (JWT pengunjung; RLS yang menegakkan kepemilikan).
 * `user_id` tidak dikirim: kolomnya default auth.uid() (migrasi 0006).
 */
export function installLikesApi() {
  setLikesApi({
    async add(songId) {
      const { error } = await createClient().from("likes").insert({ song_id: songId });
      // 23505 = sudah disukai (PK user+lagu): hasil yang diinginkan sudah tercapai, bukan galat.
      if (error && error.code !== "23505") throw error;
    },
    async remove(songId) {
      const { error } = await createClient().from("likes").delete().eq("song_id", songId);
      if (error) throw error;
    },
  });
}
