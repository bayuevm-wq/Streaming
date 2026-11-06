import { Suspense, type ReactNode } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { SearchHeader } from "@/components/ui/search-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AppSidebar } from "./app-sidebar";
import { MobileNav } from "./mobile-nav";
import { PlayerBoot } from "./player-boot";
import { PlayerDock } from "./player-dock";
import { PlayerNotices } from "./player-notices";

/**
 * Kerangka area login: sidebar, header pencarian, konten, dan player bar. Dipasang di app/(app)/layout.tsx; layout
 * tidak pernah di-unmount saat navigasi, jadi PlayerDock/PlayerBoot (dan audio singleton) tetap hidup.
 * JANGAN memindahkannya ke template.tsx (template di-remount) atau memberi `key` yang berubah.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-dvh grid-cols-[16rem_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] tablet:grid-cols-1">
      <div className="min-h-0 tablet:hidden">
        <Suspense fallback={<Skeleton className="h-full w-64" />}>
          <AppSidebar />
        </Suspense>
      </div>
      <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto">
        <SearchHeader actions={<SignOutButton />} />
        <Suspense fallback={null}>
          <MobileNav />
        </Suspense>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <div className="col-span-2 border-t border-hairline tablet:col-span-1">
        <PlayerDock />
      </div>
      <PlayerBoot />
      <PlayerNotices />
    </div>
  );
}
