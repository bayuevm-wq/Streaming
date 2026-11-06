"use client";

import { useProgress } from "@/lib/player/store";

/**
 * Garis progres 2px di tepi atas mini-player. Satu-satunya yang berlangganan `useProgress` untuk mini-player, jadi
 * pembaruan posisi (beberapa kali per detik) hanya me-render ulang elemen kecil ini. Dekoratif (aria-hidden):
 * posisi yang bisa dioperasikan ada di pemutar penuh. Mengisi lebar lewat transform agar tidak memicu layout.
 */
export function MiniProgress({ fallbackDuration }: { fallbackDuration: number }) {
  const ratio = useProgress((s) => {
    const d = s.duration || fallbackDuration;
    return d > 0 ? Math.min(1, Math.max(0, s.position / d)) : 0;
  });
  return (
    <div aria-hidden="true" data-testid="mini-progress" className="absolute inset-x-0 top-0 h-0.5 bg-control">
      <div className="h-full origin-left bg-accent" style={{ transform: `scaleX(${ratio})` }} />
    </div>
  );
}
