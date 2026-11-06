import { SignOutButton } from "@/components/auth/sign-out-button";

// Layout area yang memerlukan login. Pemutar global (PlayerBar + PlayerBoot), Sidebar, dan SearchHeader
// (components/ui) dipasang di sini pada Fase 2 agar tidak di-unmount saat navigasi.
// JANGAN memindahkannya ke template.tsx (template di-remount).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-hairline px-6 py-2">
        <span className="font-display text-title font-medium italic">Streaming</span>
        <SignOutButton />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
