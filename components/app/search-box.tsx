"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { IconSearch } from "@/components/ui/icons";

const DEBOUNCE_MS = 300;
const MAX_LENGTH = 100;

/**
 * Kotak pencarian di header. Mengetik memperbarui /cari?q=... setelah jeda 300 ms (debounce); permintaan lama
 * otomatis kalah oleh navigasi yang lebih baru. Query kosong tidak mengirim permintaan. Enter bekerja tanpa
 * JavaScript karena ini formulir GET biasa ke /cari. URL hasil bisa dibagikan dan tombol Back berfungsi.
 */
export function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQuery = params.get("q") ?? "";
  const [value, setValue] = useState(urlQuery);
  const [seenUrlQuery, setSeenUrlQuery] = useState(urlQuery);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tersinkron bila URL berubah dari luar (mis. tombol Back): diturunkan saat render, bukan lewat efek.
  if (pathname === "/cari" && urlQuery !== seenUrlQuery) {
    setSeenUrlQuery(urlQuery);
    setValue(urlQuery);
  }

  function onChange(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = next.trim().slice(0, MAX_LENGTH);
      if (!q) {
        if (pathname === "/cari" && urlQuery) router.replace("/cari");
        return; // query kosong: tidak ada permintaan
      }
      if (pathname === "/cari" && q === urlQuery) return;
      const url = `/cari?q=${encodeURIComponent(q)}`;
      if (pathname === "/cari") router.replace(url);
      else router.push(url);
    }, DEBOUNCE_MS);
  }

  return (
    <form action="/cari" role="search" className="relative w-full max-w-xl" onSubmit={(e) => {
      e.preventDefault();
      if (timer.current) clearTimeout(timer.current);
      const q = value.trim().slice(0, MAX_LENGTH);
      if (q) router.push(`/cari?q=${encodeURIComponent(q)}`);
    }}>
      <label htmlFor="q" className="sr-only">
        Cari lagu, album, atau artis
      </label>
      <IconSearch className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-lead text-muted" />
      <input
        id="q"
        name="q"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Cari lagu, album, atau artis"
        autoComplete="off"
        maxLength={MAX_LENGTH}
        className="h-10 w-full border border-control bg-surface pr-3 pl-10 text-body text-ink placeholder:text-muted hover:border-ink"
      />
    </form>
  );
}
