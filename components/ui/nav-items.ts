import { IconCredit, IconHeart, IconHome, IconLibrary, IconPlaylist, IconSearch } from "./icons";

/**
/**
 * Satu sumber untuk Sidebar (desktop) dan BottomNav (ponsel). `short` dipakai bila label panjang tak muat.
 * `inSidebar: false` = tidak di sidebar (sidebar punya bagian Playlist sendiri). `inBottom: false` = tidak di navigasi bawah:
 * navigasi bawah dibatasi MAKSIMAL 5 tab (target sentuh besar); tujuan sekunder (Kredit) ada di menu atas dan tautan di beranda.
 */
export const NAV_ITEMS = [
  { href: "/", label: "Beranda", short: "Beranda", icon: IconHome, inSidebar: true, inBottom: true },
  { href: "/cari", label: "Cari", short: "Cari", icon: IconSearch, inSidebar: true, inBottom: true },
  { href: "/library", label: "Library", short: "Library", icon: IconLibrary, inSidebar: true, inBottom: true },
  { href: "/playlist", label: "Playlist", short: "Playlist", icon: IconPlaylist, inSidebar: false, inBottom: true },
  { href: "/disukai", label: "Lagu Disukai", short: "Disukai", icon: IconHeart, inSidebar: true, inBottom: true },
  { href: "/kredit", label: "Kredit", short: "Kredit", icon: IconCredit, inSidebar: true, inBottom: false },
] as const;
