"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Akun anonim tidak bisa dipulihkan, jadi keluar memerlukan konfirmasi (F1).
export function SignOutButton() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);

  async function confirmSignOut() {
    setBusy(true);
    // Fase 2: panggil usePlayer.getState().reset() di sini agar audio berhenti dan antrean kosong.
    await createClient().auth.signOut();
    router.replace("/masuk");
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className="text-sm underline-offset-4 hover:underline">
        Keluar
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="signout-title"
        className="m-auto rounded-xl p-6 backdrop:bg-black/50 dark:bg-zinc-900 dark:text-zinc-100"
      >
        <h2 id="signout-title" className="text-lg font-semibold">
          Keluar dari mode tamu?
        </h2>
        <p className="mt-2 text-sm">Like, playlist, dan lagu pribadi akan hilang.</p>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={() => dialog.current?.close()} disabled={busy} className="rounded-full px-4 py-2 text-sm">
            Batal
          </button>
          <button
            type="button"
            onClick={confirmSignOut}
            disabled={busy}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Keluar…" : "Keluar"}
          </button>
        </div>
      </dialog>
    </>
  );
}
