// Notifikasi umum aplikasi (di luar pemutar): galat penyimpanan suka/playlist, dsb. Dirender oleh <AppNotices />.
import { create } from "zustand";

export type AppToast = { id: number; kind: "success" | "warning" | "error"; message: string };

let seq = 0;

export const useToasts = create<{
  items: AppToast[];
  push: (kind: AppToast["kind"], message: string) => void;
  dismiss: (id: number) => void;
}>()((set) => ({
  items: [],
  push(kind, message) {
    // Paling banyak 3 sekaligus; yang tertua tergeser.
    set((s) => ({ items: [...s.items, { id: ++seq, kind, message }].slice(-3) }));
  },
  dismiss(id) {
    set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
  },
}));
