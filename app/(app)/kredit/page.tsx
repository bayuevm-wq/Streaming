import type { Metadata } from "next";
import { LicenseLink } from "@/components/media/credit-list";
import { EmptyState } from "@/components/ui/empty-state";
import { IconCredit } from "@/components/ui/icons";
import { countByLicense, groupCredits, licenseDeed, safeHref } from "@/lib/credits";
import { getCredits } from "@/lib/data/credits";

export const metadata: Metadata = { title: "Kredit — Streaming" };

export default async function Page() {
  const items = await getCredits();
  const groups = groupCredits(items);
  const counts = countByLicense(items);

  return (
    <div className="grid gap-10 px-6 py-8">
      <header className="grid max-w-prose gap-3">
        <h1 className="font-display text-display font-medium italic">Kredit</h1>
        <p className="text-body text-muted">
          Semua lagu katalog berlisensi Creative Commons dan diambil dari Free Music Archive dan Incompetech. Tiap lagu menautkan ke halaman sumbernya,
          tempat lisensinya diperiksa. Musik pribadi yang kamu unggah milikmu sendiri dan tidak ditampilkan di sini.
        </p>
      </header>

      {items.length === 0 ? (
        <EmptyState icon={<IconCredit />} title="Belum ada kredit" description="Kredit lagu katalog akan muncul di sini setelah katalog diisi." />
      ) : (
        <>
          <section aria-labelledby="lisensi-h" className="grid gap-3">
            <h2 id="lisensi-h" className="font-display text-heading font-medium italic">
              Lisensi yang dipakai
            </h2>
            <ul className="grid gap-2">
              {counts.map(([license, n]) => {
                const deed = licenseDeed(license);
                const href = deed ? safeHref(deed.url) : null;
                return (
                  <li key={license} className="text-body">
                    <strong className="font-semibold">{license}</strong> · {n} lagu
                    {deed && href ? (
                      <>
                        {" "}
                        ·{" "}
                        <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Teks lisensi ${license}: ${deed.name} (tab baru)`} className="text-accent underline underline-offset-2 hover:text-accent-hover">
                          teks lisensi
                        </a>
                      </>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <p className="max-w-prose text-small text-muted">
              Berkas audio dikonversi ke MP3 192 kbps agar hemat bandwidth; tidak ada perubahan lain pada musiknya. Sampul album dan artis dibuat sendiri untuk proyek ini
              (bukan dari situs sumber).
            </p>
          </section>

          {groups.map((g) => (
            <section key={`${g.artist}-${g.album}`} aria-labelledby={`g-${g.artist}-${g.album}`.replace(/\s+/g, "-")} className="grid gap-4">
              <div className="grid gap-1">
                <h2 id={`g-${g.artist}-${g.album}`.replace(/\s+/g, "-")} className="font-display text-heading font-medium italic">
                  {g.album}
                </h2>
                <p className="text-body text-muted">{g.artist}</p>
              </div>
              <ul className="grid border-t border-hairline">
                {g.items.map((c) => (
                  <li key={c.id} className="grid gap-1 border-b border-hairline py-3">
                    <p className="flex flex-wrap items-baseline gap-x-3 text-body">
                      <span className="font-display font-medium">{c.title}</span>
                      <LicenseLink item={c} />
                    </p>
                    <p className="max-w-prose text-small text-muted [overflow-wrap:anywhere]" data-testid="credit-text">
                      {c.credit}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
