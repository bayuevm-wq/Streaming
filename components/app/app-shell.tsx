import { Suspense, type ReactNode } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { SearchForm, SearchHeader } from "@/components/ui/search-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AppBottomNav } from "./bottom-nav";
import { AppSidebar } from "./app-sidebar";
import { PlayerBoot } from "./player-boot";
import { PlayerDock } from "./player-dock";
import { AppNotices } from "./app-notices";
import { LikesBootstrap } from "./likes-bootstrap";
import { SearchBox } from "./search-box";

/**
 * Kerangka area login. Desktop: sidebar | (header pencarian + konten), lalu PlayerBar di dasar.
 * Ponsel (<= 760px): sidebar hilang; konten, lalu MiniPlayer, lalu BottomNav (tinggi total ~120px, bukan ~220px).
 * Dipasang di app/(app)/layout.tsx; layout tidak pernah di-unmount saat navigasi, jadi PlayerDock/PlayerBoot (dan audio
 * singleton) tetap hidup. JANGAN memindahkannya ke template.tsx (template di-remount) atau memberi `key` yang berubah.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-dvh grid-cols-[16rem_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] tablet:grid-cols-1 tablet:grid-rows-[minmax(0,1fr)_auto_auto]">
      <div className="min-h-0 tablet:hidden">
        <Suspense fallback={<Skeleton className="h-full w-64" />}>
          <AppSidebar />
        </Suspense>
      </div>
      <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto">
        <SearchHeader
          search={
            <Suspense fallback={<SearchForm />}>
              <SearchBox />
            </Suspense>
          }
          actions={<SignOutButton />}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <div className="col-span-2 tablet:col-span-1">
        <PlayerDock />
      </div>
      <Suspense fallback={null}>
        <AppBottomNav className="hidden tablet:block" />
      </Suspense>
      <PlayerBoot />
      <AppNotices />
      <Suspense fallback={null}>
        <LikesBootstrap />
      </Suspense>
    </div>
  );
}
