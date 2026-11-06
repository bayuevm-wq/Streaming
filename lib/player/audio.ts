// Satu elemen audio untuk seluruh aplikasi, DI LUAR siklus render React (docs/architecture.md, §10).
// Dibuat sekali, tidak pernah masuk JSX/DOM, sehingga tidak ikut unmount saat navigasi dan tidak pernah ada dua audio
// berbunyi bersamaan. Disimpan di globalThis agar bertahan lewat Fast Refresh di dev dan bisa diperiksa uji E2E.

type Holder = { __streamingAudio?: HTMLAudioElement };

export function getAudio(): HTMLAudioElement {
  const g = globalThis as unknown as Holder;
  if (!g.__streamingAudio) {
    if (typeof Audio === "undefined") throw new Error("getAudio() hanya boleh dipanggil di browser");
    const a = new Audio();
    a.preload = "metadata";
    g.__streamingAudio = a;
  }
  return g.__streamingAudio;
}

/** Untuk uji dan reset: ada atau belum, tanpa membuatnya. */
export function peekAudio(): HTMLAudioElement | undefined {
  return (globalThis as unknown as Holder).__streamingAudio;
}
