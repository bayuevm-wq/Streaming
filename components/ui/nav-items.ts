import { IconHeart, IconHome, IconLibrary, IconPlaylist, IconSearch } from "./icons";

/**
 * Satu sumber untuk Sidebar (desktop) dan BottomNav (ponsel). `short` dipakai bila label panjang tak muat.
 * `inSidebar: false` = hanya di navigasi bawah (sidebar sudah punya bagian Playlist sendiri).
 */
export const NAV_ITEMS = [
  { href: "/", label: "Beranda", short: "Beranda", icon: IconHome, inSidebar: true },
  { href: "/cari", label: "Cari", short: "Cari", icon: IconSearch, inSidebar: true },
  { href: "/library", label: "Library", short: "Library", icon: IconLibrary, inSidebar: true },
  { href: "/playlist", label: "Playlist", short: "Playlist", icon: IconPlaylist, inSidebar: false },
  { href: "/disukai", label: "Lagu Disukai", short: "Disukai", icon: IconHeart, inSidebar: true },
] as const;
