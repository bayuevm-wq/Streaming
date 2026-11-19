// Kredit lagu katalog. CC BY dan CC BY-SA mewajibkan atribusi, jadi aplikasi menampilkan judul, artis, lisensi, dan tautan
// ke halaman sumber tiap lagu (halaman album dan /kredit). Fungsi murni agar bisa diuji unit.

export type CatalogLicense = "CC0 1.0" | "CC BY 4.0" | "CC BY-SA 4.0";

export type CreditItem = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  license: string;
  /** Halaman LAGU di sumbernya (tempat lisensi diperiksa). */
  sourceUrl: string;
  /** Teks atribusi lengkap, ditampilkan apa adanya. */
  credit: string;
};

const DEEDS: Record<CatalogLicense, { url: string; name: string }> = {
  "CC0 1.0": { url: "https://creativecommons.org/publicdomain/zero/1.0/", name: "CC0 1.0 Universal (domain publik)" },
  "CC BY 4.0": { url: "https://creativecommons.org/licenses/by/4.0/", name: "Creative Commons Attribution 4.0 International" },
  "CC BY-SA 4.0": { url: "https://creativecommons.org/licenses/by-sa/4.0/", name: "Creative Commons Attribution-ShareAlike 4.0 International" },
};

/** Tautan teks lisensi (deed) untuk lisensi yang dikenal; null untuk yang tak dikenal (jangan menautkan tebakan). */
export function licenseDeed(license: string): { url: string; name: string } | null {
  return (DEEDS as Record<string, { url: string; name: string }>)[license] ?? null;
}

/** Hanya http(s) yang boleh menjadi tautan (cegah `javascript:` dari data yang rusak). */
export function safeHref(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export type CreditGroup = { album: string; artist: string; items: CreditItem[] };

/** Mengelompokkan per album+artis, mempertahankan urutan kemunculan (urutan data = urutan tampil). */
export function groupCredits(items: CreditItem[]): CreditGroup[] {
  const map = new Map<string, CreditGroup>();
  for (const it of items) {
    const album = it.album ?? "Single";
    const key = `${it.artist}\u0000${album}`;
    let g = map.get(key);
    if (!g) {
      g = { album, artist: it.artist, items: [] };
      map.set(key, g);
    }
    g.items.push(it);
  }
  return [...map.values()];
}

/** Ringkasan hitungan per lisensi untuk /kredit, mis. [["CC0 1.0", 9], ["CC BY 4.0", 6], ["CC BY-SA 4.0", 2]]. */
export function countByLicense(items: CreditItem[]): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) m.set(it.license, (m.get(it.license) ?? 0) + 1);
  const order = Object.keys(DEEDS);
  return [...m.entries()].sort((a, b) => (order.indexOf(a[0]) + 99) % 99 - (order.indexOf(b[0]) + 99) % 99 || a[0].localeCompare(b[0]));
}
