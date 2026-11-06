import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { IconSearch } from "@/components/ui/icons";

/** 404 rapi di dalam kerangka aplikasi (spec F4): ID tidak valid atau tidak ada. Pemutar tetap berjalan. */
export default function NotFound() {
  return (
    <div className="px-6 py-8">
      <EmptyState
        icon={<IconSearch />}
        title="Halaman tidak ditemukan"
        description="Album, artis, atau lagu yang kamu cari tidak ada atau sudah dihapus."
        action={<ButtonLink href="/">Kembali ke beranda</ButtonLink>}
      />
    </div>
  );
}
