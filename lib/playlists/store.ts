import { create } from "zustand";

export type PlaylistSummary = { id: string; name: string; count: number };

type State = {
  items: PlaylistSummary[];
  /** false sampai data server dimuat (mencegah kedipan "Belum ada playlist"). */
  hydrated: boolean;
  hydrate: (items: PlaylistSummary[]) => void;
  add: (p: PlaylistSummary) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  adjustCount: (id: string, delta: number) => void;
};

/** Daftar playlist milik pengunjung (untuk sidebar, dialog "Tambahkan ke playlist", dan halaman /playlist). */
export const usePlaylists = create<State>()((set) => ({
  items: [],
  hydrated: false,
  hydrate: (items) => set({ items, hydrated: true }),
  add: (p) => set((s) => ({ items: [p, ...s.items.filter((x) => x.id !== p.id)] })),
  rename: (id, name) => set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, name } : x)) })),
  remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
  adjustCount: (id, delta) => set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, count: Math.max(0, x.count + delta) } : x)) })),
}));
