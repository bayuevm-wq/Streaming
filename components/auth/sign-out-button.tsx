"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { usePlayer } from "@/lib/player/store";

// Akun anonim tidak bisa dipulihkan, jadi keluar memerlukan konfirmasi (F1).
// Dialog dipisah dari tombol agar bisa dipasang DI LUAR menu popover (dialog di dalam popover yang tertutup tidak akan tampil).
export function SignOutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function confirmSignOut() {
    setBusy(true);
    usePlayer.getState().reset(); // audio berhenti dan antrean kosong (spec F1)
    await createClient().auth.signOut();
    router.replace("/masuk");
    router.refresh();
  }

  return (
    <Dialog
        open={open}
        onClose={onClose}
        title="Keluar dari mode tamu?"
        description="Like, playlist, dan lagu pribadi akan hilang."
        actions={
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Batal
            </Button>
            <Button variant="danger" onClick={confirmSignOut} loading={busy}>
              Keluar
            </Button>
          </>
        }
      />
  );
}

/** Tombol Keluar (desktop) beserta dialog konfirmasinya. */
export function SignOutButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Keluar
      </Button>
      <SignOutDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
