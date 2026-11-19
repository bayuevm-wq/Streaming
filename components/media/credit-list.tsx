import Link from "next/link";
import { licenseDeed, safeHref, type CreditItem } from "@/lib/credits";

/**
 * Tautan lisensi sebuah lagu: teks lisensi menuju halaman LAGU di sumbernya (`sourceUrl`, tempat lisensi diperiksa).
 * Nama aksesibelnya memuat teks yang tampak (label-in-name) dan menyebut lagunya, karena banyak tautan serupa di satu halaman.
 */
export function LicenseLink({ item }: { item: Pick<CreditItem, "title" | "license" | "sourceUrl"> }) {
  const href = safeHref(item.sourceUrl);
  if (!href) return <span>{item.license}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${item.license}, halaman sumber lagu ${item.title} (tab baru)`}
      className="font-semibold text-accent underline underline-offset-2 hover:text-accent-hover"
    >
      {item.license}
    </a>
  );
}

/** Kredit ringkas untuk halaman album: judul, artis, lisensi (tautan ke sumber). Teks atribusi lengkap ada di /kredit. */
export function CreditList({ items }: { items: CreditItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="kredit-h" className="grid gap-3 border-t border-hairline pt-6">
      <h2 id="kredit-h" className="font-display text-heading font-medium italic">
        Kredit
      </h2>
      <ul className="grid gap-2">
        {items.map((c) => (
          <li key={c.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-body">
            <span className="font-display font-medium">{c.title}</span>
            <span className="text-muted">{c.artist}</span>
            <LicenseLink item={c} />
          </li>
        ))}
      </ul>
      <p className="text-small text-muted">
        Lagu dilisensikan Creative Commons dan dimainkan di sini dengan atribusi. Teks kredit lengkap dan tautan lisensi ada di{" "}
        <Link href="/kredit" className="text-ink underline underline-offset-2 hover:text-accent">
          halaman Kredit
        </Link>
        {items.some((c) => licenseDeed(c.license)?.name.includes("ShareAlike")) ? ". Lagu CC BY-SA tetap berlisensi CC BY-SA 4.0 bila kamu menyalin atau mengubahnya" : ""}.
      </p>
    </section>
  );
}
