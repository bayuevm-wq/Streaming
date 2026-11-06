"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/", label: "Beranda" },
  { href: "/cari", label: "Cari" },
  { href: "/library", label: "Library" },
  { href: "/disukai", label: "Disukai" },
] as const;

/**
 * Navigasi untuk layar <= 760px, menggantikan sidebar (yang disembunyikan). SEMENTARA: desain navigasi ponsel
 * (drawer atau tab bawah) belum diputuskan; ini hanya agar semua halaman tetap terjangkau.
 */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Utama" className="hidden border-b border-hairline px-4 tablet:block">
      <ul className="flex gap-1 overflow-x-auto">
        {ITEMS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("block border-b-[3px] px-3 py-2.5 text-small whitespace-nowrap", active ? "border-accent font-semibold text-accent" : "border-transparent text-ink")}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
