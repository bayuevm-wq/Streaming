// Layout area yang memerlukan login. Pemutar global (PlayerBar + PlayerBoot) dan Sidebar akan dipasang di sini
// pada Fase 2 agar tidak di-unmount saat navigasi. JANGAN memindahkannya ke template.tsx (template di-remount).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-zinc-200 px-6 py-3 text-sm font-medium dark:border-zinc-800">Streaming</header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
