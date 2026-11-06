/** 84 -> "1:24", 3725 -> "1:02:05". Dipakai di pemutar, baris lagu, dan aria-valuetext. */
export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/**
 * Total durasi koleksi (album/playlist), dibulatkan ke BAWAH agar tidak melebih-lebihkan:
 * < 10 menit: "1 mnt 32 dtk" (detik tetap tampil); 10–59 menit: "23 mnt"; >= 1 jam: "1 jam 5 mnt" / "2 jam".
 * 0 detik -> "0 dtk".
 */
export function formatTotalDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return `${s} dtk`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h} jam ${m} mnt` : `${h} jam`;
  if (m < 10) return s % 60 > 0 ? `${m} mnt ${s % 60} dtk` : `${m} mnt`;
  return `${m} mnt`;
}

/** Ukuran berkas untuk manusia, desimal koma: 340 -> "340 B", 1536 -> "1,5 KB", 8_650_752 -> "8,3 MB". */
export function formatFileSize(bytes: number): string {
  const n = Math.max(0, bytes);
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1).replace(".", ",")} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
