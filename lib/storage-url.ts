/**
 * URL publik objek Storage di bucket publik (audio, covers). Murni string: tanpa jaringan, aman dipanggil di server maupun klien.
 * Bucket privat (user-audio, user-covers) memakai signed URL dan TIDAK lewat fungsi ini.
 */
export function publicStorageUrl(bucket: "audio" | "covers", path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${encoded}`;
}
