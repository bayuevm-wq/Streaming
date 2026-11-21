"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { SignOutButton, SignOutDialog } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { IconCredit, IconMenu } from "@/components/ui/icons";

/**
 * Aksi di kanan header.
 * - Desktop (> 760px): tombol Keluar seperti biasa (Kredit ada di sidebar).
 * - Ponsel/tablet (<= 760px): sidebar tidak ada dan navigasi bawah dibatasi 5 tab, jadi tujuan sekunder (Kredit) dan Keluar
 *   dipindah ke MENU ATAS. Memakai atribut `popover` bawaan browser: Esc dan klik di luar menutupnya, fokus kembali ke
 *   tombol, dan tanpa JavaScript tambahan untuk pengelolaan fokus.
 */
export function HeaderActions() {
  const id = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const close = () => menuRef.current?.hidePopover?.();
  const [signOutOpen, setSignOutOpen] = useState(false);

  return (
    <>
      <div className="tablet:hidden">
        <SignOutButton />
      </div>
      <div className="hidden tablet:block">
        <button
          type="button"
          popoverTarget={id}
          aria-label="Menu"
          className="grid size-11 place-items-center text-title text-ink hover:bg-raised"
        >
          <IconMenu />
        </button>
        {/* Tidak ada kelas `display` pada popover: kelas itu akan menimpa display:none milik popover yang tertutup. */}
        <div ref={menuRef} id={id} popover="auto" className="fixed inset-auto top-14 right-4 m-0 w-56 border border-control bg-surface p-2 text-ink shadow-float">
          <nav aria-label="Menu atas">
            <ul className="grid gap-1">
              <li>
                <Link href="/kredit" onClick={close} className="flex min-h-11 items-center gap-3 px-3 text-body hover:bg-raised">
                  <IconCredit className="text-lead" />
                  Kredit
                </Link>
              </li>
              <li>
                <Button
                  variant="ghost"
                  className="min-h-11 w-full justify-start px-3"
                  onClick={() => {
                    close();
                    setSignOutOpen(true);
                  }}
                >
                  Keluar
                </Button>
              </li>
            </ul>
          </nav>
        </div>
        {/* di luar popover: dialog di dalam popover yang tertutup (display:none) tidak akan tampil */}
        <SignOutDialog open={signOutOpen} onClose={() => setSignOutOpen(false)} />
      </div>
    </>
  );
}
