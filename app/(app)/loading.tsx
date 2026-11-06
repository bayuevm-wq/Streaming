import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

// Boundary Suspense untuk seluruh halaman di area (app). Semua halaman membaca data runtime (cookie sesi,
// params), jadi shell statis (layout) dikirim dulu dan isi halaman mengalir menyusul.
export default function Loading() {
  return (
    <SkeletonGroup>
      <div className="mx-auto max-w-2xl space-y-3 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
    </SkeletonGroup>
  );
}
