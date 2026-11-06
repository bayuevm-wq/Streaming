"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { usePlayer } from "@/lib/player/store";

// Akun anonim tidak bisa dipulihkan, jadi keluar memerlukan konfirmasi (F1).
export function SignOutButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirmSignOut() {
    setBusy(true);
    usePlayer.getState().reset(); // audio berhenti dan antrean kosong (spec F1)
    await createClient().auth.signOut();
    router.replace("/masuk");
    router.refresh();
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Keluar
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Keluar dari mode tamu?"
        description="Like, playlist, dan lagu pribadi akan hilang."
        actions={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Batal
            </Button>
            <Button variant="danger" onClick={confirmSignOut} loading={busy}>
              Keluar
            </Button>
          </>
        }
      />
    </>
  );
}
