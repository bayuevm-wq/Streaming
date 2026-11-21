import type { ReactNode } from "react";

/** Bagian halaman dengan judul. Judul h2 ber-id agar bagian bisa dinamai untuk pembaca layar. */
export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-h`} className="grid gap-4">
      <h2 id={`${id}-h`} className="font-display text-heading font-medium italic">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Kisi kartu album/artis. Di ponsel (<= 640px) menjadi BARIS GESER horizontal (snap) selebar layar, kartu 9rem: satu kartu
 * persegi penuh-layar menghabiskan layar pertama, sedangkan baris geser memperlihatkan sebagian kartu berikutnya sebagai petunjuk.
 * Tautan di dalam kartu tetap bisa difokus keyboard, jadi wilayah geser ini dapat dioperasikan tanpa mouse.
 */
export const CARD_GRID =
  "grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-5 " +
  "phone:flex phone:snap-x phone:snap-mandatory phone:gap-3 phone:overflow-x-auto phone:-mx-6 phone:px-6 phone:scroll-px-6 phone:pb-3 " +
  "phone:*:w-36 phone:*:shrink-0 phone:*:snap-start";
