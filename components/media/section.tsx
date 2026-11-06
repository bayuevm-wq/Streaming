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

export const CARD_GRID = "grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-5";
