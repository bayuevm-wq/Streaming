import { AppShell } from "@/components/app/app-shell";

// Layout area yang memerlukan login: sidebar, header pencarian, PlayerBar, dan PlayerBoot (docs/architecture.md, 3.2).
// Layout ini tidak di-unmount saat navigasi, sehingga pemutar dan audio singleton tetap berjalan.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
