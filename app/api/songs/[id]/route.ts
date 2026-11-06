import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { requestIsSameOrigin } from "@/lib/security/origin";
import { createClient, currentUser } from "@/lib/supabase/server";

// Hapus lagu pribadi milik sendiri (docs/architecture.md 14.3 butir 3): kedaluwarsakan dulu (langsung tak terlihat dan
// slot bebas, atomik di database), lalu hapus file Storage, lalu baris (cascade ke like dan isi playlist).
// Bila penghapusan file/baris gagal, lagu sudah tak terlihat dan job per jam menuntaskannya.

const fail = (status: number, error: string) => Response.json({ error }, { status });

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!requestIsSameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "unauthenticated");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, "not_found");

  const db = adminClient();
  const { data: song } = await db
    .from("songs")
    .select("id,audio_path,cover_path")
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("visibility", "private")
    .maybeSingle();
  if (!song) return fail(404, "not_found"); // bukan milik sendiri = tidak ada (tidak membocorkan keberadaan)

  const supabase = await createClient();
  const { error: expErr } = await supabase.rpc("expire_my_song", { p_song_id: id });
  if (expErr) return fail(500, "expire_failed");

  const files = await db.storage.from("user-audio").remove([song.audio_path as string]);
  const covers = song.cover_path ? await db.storage.from("user-covers").remove([song.cover_path as string]) : { error: null };
  if (files.error || covers.error) return Response.json({ ok: true, cleanup: "deferred" }); // lagu sudah tak terlihat; job menuntaskan

  const { error } = await db.from("songs").delete().eq("id", id).eq("owner_id", user.id);
  return Response.json({ ok: true, cleanup: error ? "deferred" : "done" });
}
