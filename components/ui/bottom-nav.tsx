import Link from "next/link";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "./nav-items";

/**
 * Navigasi bawah untuk layar <= 760px (menggantikan sidebar). Lima tujuan, ikon di atas label, target >= 56px.
 * Aktif: teks aksen + garis atas 3px + aria-current="page" (bukan warna saja). Menghormati area aman di dasar layar.
 */
export function BottomNav({ current, className }: { current: string; className?: string }) {
  return (
    <nav aria-label="Utama" className={cn("border-t border-hairline bg-ground pb-[env(safe-area-inset-bottom)]", className)}>
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map(({ href, short, icon: Icon }) => {
          const active = current === href || (href !== "/" && current.startsWith(`${href}/`));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "grid min-h-14 place-items-center content-center gap-0.5 border-t-[3px] px-1 py-1.5 text-caption",
                  active ? "border-accent font-semibold text-accent" : "border-transparent text-muted",
                )}
              >
                <Icon className="text-title" />
                {short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
