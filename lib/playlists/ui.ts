import { create } from "zustand";
import { playlistsContaining } from "./api";

export type Dialog =
  | { kind: "create" }
  | { kind: "rename"; id: string; name: string }
  | { kind: "delete"; id: string; name: string }
  | { kind: "add"; songId: string; title: string; contains: string[] | null };

type UiState = {
  dialog: Dialog | null;
  /** Naik tiap dialog dibuka; dipakai untuk mereset isian. */
  opened: number;
  openCreate: () => void;
  openRename: (id: string, name: string) => void;
  openDelete: (id: string, name: string) => void;
  openAdd: (songId: string, title: string) => void;
  markContained: (playlistId: string) => void;
  close: () => void;
};

export const usePlaylistUi = create<UiState>()((set, get) => ({
  dialog: null,
  opened: 0,
  openCreate: () => set((s) => ({ dialog: { kind: "create" }, opened: s.opened + 1 })),
  openRename: (id, name) => set((s) => ({ dialog: { kind: "rename", id, name }, opened: s.opened + 1 })),
  openDelete: (id, name) => set((s) => ({ dialog: { kind: "delete", id, name }, opened: s.opened + 1 })),
  openAdd(songId, title) {
    set((s) => ({ dialog: { kind: "add", songId, title, contains: null }, opened: s.opened + 1 }));
    // muat playlist mana yang sudah berisi lagu ini; abaikan hasil bila dialog sudah berganti
    void playlistsContaining(songId).then((r) => {
      const d = get().dialog;
      if (d?.kind !== "add" || d.songId !== songId) return;
      set({ dialog: { ...d, contains: r.ok ? r.data : [] } });
    });
  },
  markContained(playlistId) {
    const d = get().dialog;
    if (d?.kind === "add") set({ dialog: { ...d, contains: [...(d.contains ?? []), playlistId] } });
  },
  close: () => set({ dialog: null }),
}));
