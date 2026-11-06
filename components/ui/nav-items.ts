import { IconHeart, IconHome, IconLibrary, IconSearch } from "./icons";

/** Satu sumber untuk Sidebar (desktop) dan BottomNav (ponsel). `short` dipakai bila label panjang tak muat. */
export const NAV_ITEMS = [
  { href: "/", label: "Beranda", short: "Beranda", icon: IconHome },
  { href: "/cari", label: "Cari", short: "Cari", icon: IconSearch },
  { href: "/library", label: "Library", short: "Library", icon: IconLibrary },
  { href: "/disukai", label: "Lagu Disukai", short: "Disukai", icon: IconHeart },
] as const;
