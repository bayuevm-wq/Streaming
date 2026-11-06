// Status suka (F7). Aturan spec: toggle bersifat optimistic (UI berubah seketika; bila server gagal, UI dikembalikan dan
// toast galat muncul), unik per (pengguna, lagu), klik cepat berulang tidak membuat duplikat, dan status sinkron di
// semua tempat (baris lagu, player bar). Penyimpanan sebenarnya lewat `LikesApi` agar logika ini bisa diuji tanpa jaringan.
import { create } from "zustand";
import { useToasts } from "../ui/toasts.ts";

export type LikesApi = {
  add: (songId: string) => Promise<void>;
  remove: (songId: string) => Promise<void>;
};

let api: LikesApi = {
  add: async () => {
    throw new Error("LikesApi belum dipasang");
  },
  remove: async () => {
    throw new Error("LikesApi belum dipasang");
  },
};
export function setLikesApi(next: LikesApi) {
  api = next;
}

type LikesState = {
  ids: ReadonlySet<string>;
  /** false sampai data server dimuat; mencegah kedipan "belum ada lagu disukai". */
  hydrated: boolean;
  /** Mengganti seluruh set dari data server (dipanggil saat layout dimuat). */
  hydrate: (ids: string[]) => void;
  /** Membalik status suka. Mengembalikan janji yang selesai setelah server menjawab (sukses atau di-rollback). */
  toggle: (songId: string) => Promise<void>;
};

// Operasi untuk lagu yang sama dijalankan BERURUTAN, sehingga klik cepat suka -> batal suka berakhir konsisten.
const chain = new Map<string, Promise<void>>();

export const useLikes = create<LikesState>()((set, get) => ({
  ids: new Set<string>(),
  hydrated: false,

  hydrate(ids) {
    set({ ids: new Set(ids), hydrated: true });
  },

  toggle(songId) {
    const wantLiked = !get().ids.has(songId);
    // 1) Optimistic: UI berubah sekarang juga.
    set((s) => {
      const next = new Set(s.ids);
      if (wantLiked) next.add(songId);
      else next.delete(songId);
      return { ids: next };
    });
    // 2) Simpan ke server setelah operasi sebelumnya untuk lagu ini selesai.
    const run = (chain.get(songId) ?? Promise.resolve()).then(async () => {
      try {
        if (wantLiked) await api.add(songId);
        else await api.remove(songId);
      } catch {
        // 3) Rollback hanya bila status sekarang MASIH hasil klik ini (belum dibalik klik berikutnya).
        if (get().ids.has(songId) === wantLiked) {
          set((s) => {
            const next = new Set(s.ids);
            if (wantLiked) next.delete(songId);
            else next.add(songId);
            return { ids: next };
          });
        }
        useToasts.getState().push("error", wantLiked ? "Gagal menyukai lagu. Coba lagi." : "Gagal membatalkan suka. Coba lagi.");
      }
    });
    chain.set(songId, run);
    void run.finally(() => {
      if (chain.get(songId) === run) chain.delete(songId);
    });
    return run;
  },
}));
