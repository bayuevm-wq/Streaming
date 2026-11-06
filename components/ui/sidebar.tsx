import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconHome, IconLibrary, IconPlaylist, IconPlus, IconSearch, IconHeart } from "./icons";

const NAV = [
  { href: "/", label: "Beranda", icon: IconHome },
  { href: "/cari", label: "Cari", icon: IconSearch },
  { href: "/library", label: "Library", icon: IconLibrary },
  { href: "/disukai", label: "Lagu Disukai", icon: IconHeart },
] as const;

type Props = {
  /** Jalur aktif, mis. "/" atau "/library". */
  current: string;
  playlists: { id: string; name: string }[];
  onCreatePlaylist?: () => void;
  footer?: ReactNode;
};

/** Sidebar. Item aktif: teks aksen + garis kiri 3px + aria-current="page" (bukan warna saja). */
export function Sidebar({ current, playlists, onCreatePlaylist, footer }: Props) {
  const item = (active: boolean) =>
    cn(
      "flex items-center gap-3 border-l-[3px] px-3 py-2 text-body hover:bg-surface",
      active ? "border-accent font-semibold text-accent" : "border-transparent text-ink",
    );
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-6 border-r border-hairline bg-ground p-4" aria-label="Navigasi samping">
      <p className="px-3 font-display text-heading font-medium italic">Streaming</p>
      <nav aria-label="Utama">
        <ul className="grid gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = current === href;
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? "page" : undefined} className={item(active)}>
                  <Icon className="text-lead" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <nav aria-label="Playlist" className="grid min-h-0 gap-2">
        <div className="flex items-center justify-between px-3">
          <h2 className="text-small font-semibold text-muted">Playlist</h2>
          <button
            type="button"
            onClick={onCreatePlaylist}
            aria-label="Buat playlist"
            className="grid size-8 place-items-center text-lead text-ink hover:bg-raised"
          >
            <IconPlus />
          </button>
        </div>
        {playlists.length === 0 ? (
          <p className="px-3 text-small text-muted">Belum ada playlist.</p>
        ) : (
          <ul className="grid gap-0.5 overflow-y-auto">
            {playlists.map((p) => {
              const href = `/playlist/${p.id}`;
              const active = current === href;
              return (
                <li key={p.id}>
                  <Link href={href} aria-current={active ? "page" : undefined} className={item(active)}>
                    <IconPlaylist className="text-lead" />
                    <span className="truncate">{p.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
      {footer ? <div className="mt-auto px-3">{footer}</div> : null}
    </aside>
  );
}
