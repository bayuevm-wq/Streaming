import type { ReactNode } from "react";
import { IconSearch } from "./icons";

type Props = {
  defaultQuery?: string;
  /** Mengganti formulir bawaan, mis. SearchBox ber-debounce di aplikasi. */
  search?: ReactNode;
  /** Slot kanan: menu pengguna / tombol Keluar. */
  actions?: ReactNode;
};

/**
 * Header pencarian. Formulir GET biasa ke /cari?q=..., jadi bekerja tanpa JavaScript, URL hasil bisa dibagikan,
 * dan tombol Back berfungsi (spec F6). Debounce dan pembatalan permintaan ada di halaman hasil.
 */
export function SearchForm({ defaultQuery = "" }: { defaultQuery?: string }) {
  return (
    <form action="/cari" role="search" className="relative w-full max-w-xl">
        <label htmlFor="q" className="sr-only">
          Cari lagu, album, atau artis
        </label>
        <IconSearch className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-lead text-muted" />
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={defaultQuery}
          placeholder="Cari lagu, album, artis"
          autoComplete="off"
          maxLength={100}
          className="h-10 w-full border border-control bg-surface pr-3 pl-10 text-body text-ink placeholder:text-muted hover:border-ink"
        />
    </form>
  );
}

export function SearchHeader({ defaultQuery = "", search, actions }: Props) {
  return (
    <header className="flex items-center gap-4 border-b border-hairline bg-ground px-6 py-3 phone:px-4">
      {search ?? <SearchForm defaultQuery={defaultQuery} />}
      <div className="ml-auto flex items-center gap-3">{actions}</div>
    </header>
  );
}
