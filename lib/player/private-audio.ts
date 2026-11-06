"use client";

import { createClient } from "@/lib/supabase/client";
import { cachedPrivateUrl, setSigner } from "./private-url";
import { setSyncUrlResolver, setUrlResolver } from "./store";
import { prefetchPrivateUrl } from "./private-url";

let installed = false;

/**
 * Memasang pemutaran lagu pribadi: signed URL 1 jam dibuat SAAT lagu akan diputar (spec F5), dengan jalur cepat dari
 * cache bila sudah di-pra-ambil (fallback Safari, spike S4). Idempoten; dipanggil dari PlayerBoot dan daftar library.
 * Path objek deterministik: `{uid}/{songId}.mp3` (reserve_upload), jadi cukup id lagu.
 */
export function installPrivateAudio() {
  if (installed) return;
  installed = true;
  const supabase = createClient();
  setSigner(async (songId) => {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) return null;
    const { data, error } = await supabase.storage.from("user-audio").createSignedUrl(`${uid}/${songId}.mp3`, 3600);
    return error ? null : (data?.signedUrl ?? null);
  });
  setSyncUrlResolver((t) => (t.visibility === "private" ? cachedPrivateUrl(t.id) : null));
  setUrlResolver(async (t) => {
    if (t.audioUrl) return t.audioUrl;
    return t.visibility === "private" ? await prefetchPrivateUrl(t.id) : null;
  });
}
