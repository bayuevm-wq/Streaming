// Store pemutar global (Zustand). Seluruh logika antrean ada di sini; komponen hanya membaca state dan memanggil aksi.
// Aturan dari spec F2: pemutaran tidak berhenti saat berpindah rute, antrean tidak ter-reset oleh navigasi,
// "Berikutnya" berulang cepat tidak membuat dua audio berbunyi, file rusak dilewati, dan autoplay yang ditolak
// browser mengembalikan UI ke jeda tanpa galat.
import { create } from "zustand";
import { getAudio } from "./audio.ts";

export type Track = {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  coverUrl: string | null;
  /** URL audio siap putar. Lagu publik: URL publik Storage (dibuat server). Lagu pribadi: kosong; diselesaikan resolver. */
  audioUrl: string | null;
  durationSec: number;
  visibility: "public" | "private";
};

export type PlayerStatus = "idle" | "loading" | "playing" | "paused";
export type Notice = { id: number; kind: "error" | "warning"; message: string };

type PlayerState = {
  queue: Track[];
  index: number;
  status: PlayerStatus;
  /** Bertambah setiap permintaan putar; hasil asinkron dengan token usang dibuang. */
  token: number;
  volume: number; // 0-100
  notice: Notice | null;
  playList: (tracks: Track[], startIndex: number) => Promise<void>;
  playIndex: (index: number) => Promise<void>;
  toggle: () => void;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seek: (seconds: number) => void;
  setVolume: (value: number) => void;
  enqueue: (track: Track) => void;
  dismissNotice: () => void;
  /** Dipakai saat Keluar: audio berhenti dan antrean kosong. */
  reset: () => void;
};

/** Posisi dan durasi dipisah agar daftar lagu tidak ter-render ulang empat kali per detik. */
export const useProgress = create<{ position: number; duration: number }>(() => ({ position: 0, duration: 0 }));

/**
 * Menyelesaikan URL audio. Lagu publik sudah membawa audioUrl. Lagu pribadi (Fase 4) harus mendaftarkan resolver yang
 * membuat signed URL 1 jam SAAT lagu akan diputar (keputusan spec #6).
 */
export type UrlResolver = (track: Track) => Promise<string | null>;
let urlResolver: UrlResolver = async (t) => t.audioUrl;
export function setUrlResolver(fn: UrlResolver) {
  urlResolver = fn;
}

let noticeSeq = 0;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const usePlayer = create<PlayerState>()((set, get) => ({
  queue: [],
  index: -1,
  status: "idle",
  token: 0,
  volume: 100,
  notice: null,

  async playList(tracks, startIndex) {
    if (tracks.length === 0) return;
    set({ queue: tracks });
    await load(clamp(startIndex, 0, tracks.length - 1));
  },

  async playIndex(index) {
    await load(index);
  },

  toggle() {
    const { status } = get();
    if (status === "idle" || status === "loading") return;
    const a = getAudio();
    if (a.paused) {
      void a.play().catch(() => set({ status: "paused" }));
    } else {
      a.pause();
    }
  },

  async next() {
    const { index, queue } = get();
    if (index + 1 < queue.length) await load(index + 1);
    else stopAtEnd();
  },

  async prev() {
    const a = getAudio();
    const { index } = get();
    if (a.currentTime > 3) {
      a.currentTime = 0;
      useProgress.setState({ position: 0 });
    } else {
      await load(Math.max(0, index - 1));
    }
  },

  seek(seconds) {
    const a = getAudio();
    const duration = useProgress.getState().duration;
    const t = clamp(seconds, 0, duration > 0 ? duration : seconds);
    a.currentTime = t;
    useProgress.setState({ position: t });
  },

  setVolume(value) {
    const v = clamp(Math.round(value), 0, 100);
    getAudio().volume = v / 100;
    set({ volume: v });
  },

  enqueue(track) {
    set((s) => ({ queue: [...s.queue, track] }));
  },

  dismissNotice() {
    set({ notice: null });
  },

  reset() {
    const a = getAudio();
    a.pause();
    a.removeAttribute("src");
    a.load();
    set((s) => ({ queue: [], index: -1, status: "idle", token: s.token + 1, notice: null }));
    useProgress.setState({ position: 0, duration: 0 });
  },
}));

function notify(kind: Notice["kind"], message: string) {
  usePlayer.setState({ notice: { id: ++noticeSeq, kind, message } });
}

/** Setelah lagu terakhir: berhenti dan kembali ke awal lagu terakhir, tanpa galat. */
function stopAtEnd() {
  const a = getAudio();
  a.pause();
  a.currentTime = 0;
  usePlayer.setState({ status: "paused" });
  useProgress.setState({ position: 0 });
}

async function skipBroken(index: number) {
  const { queue } = usePlayer.getState();
  const t = queue[index];
  notify("error", `Tidak dapat memutar “${t?.title ?? "lagu"}”. Melewati ke lagu berikutnya.`);
  if (index + 1 < queue.length) await load(index + 1);
  else stopAtEnd();
}

async function load(index: number) {
  const { queue, token } = usePlayer.getState();
  const track = queue[index];
  if (!track) return;
  const mine = token + 1;
  usePlayer.setState({ token: mine, index, status: "loading" });
  useProgress.setState({ position: 0, duration: track.durationSec });

  let url: string | null = null;
  try {
    url = await urlResolver(track);
  } catch {
    url = null;
  }
  if (usePlayer.getState().token !== mine) return; // permintaan lain mendahului (klik "Berikutnya" berulang)
  if (!url) return skipBroken(index);

  const a = getAudio();
  a.src = url;
  try {
    await a.play();
    if (usePlayer.getState().token === mine) usePlayer.setState({ status: "playing" });
  } catch (e) {
    if (usePlayer.getState().token !== mine) return;
    const name = (e as { name?: string } | undefined)?.name;
    if (name === "AbortError") return; // diinterupsi oleh pemuatan berikutnya
    if (name === "NotAllowedError") {
      usePlayer.setState({ status: "paused" }); // autoplay ditolak: kembali ke jeda tanpa galat
      return;
    }
    return skipBroken(index);
  }
}

/** Memasang pendengar event pada elemen audio. Idempoten; dipanggil sekali oleh <PlayerBoot />. */
export function initPlayer() {
  const a = getAudio();
  const flagged = a as HTMLAudioElement & { __wired?: boolean };
  if (flagged.__wired) return;
  flagged.__wired = true;

  a.addEventListener("timeupdate", () => useProgress.setState({ position: a.currentTime }));
  const syncDuration = () => {
    if (Number.isFinite(a.duration) && a.duration > 0) useProgress.setState({ duration: a.duration });
  };
  a.addEventListener("loadedmetadata", syncDuration);
  a.addEventListener("durationchange", syncDuration);
  a.addEventListener("play", () => {
    if (usePlayer.getState().status !== "loading") usePlayer.setState({ status: "playing" });
  });
  a.addEventListener("playing", () => usePlayer.setState({ status: "playing" }));
  a.addEventListener("pause", () => {
    const { status } = usePlayer.getState();
    if (status === "playing") usePlayer.setState({ status: "paused" });
  });
  a.addEventListener("ended", () => void usePlayer.getState().next());
  a.addEventListener("error", () => {
    const { index, status } = usePlayer.getState();
    if (status === "idle" || index < 0 || !a.getAttribute("src")) return; // reset() menghapus src: bukan galat
    void skipBroken(index);
  });
}
