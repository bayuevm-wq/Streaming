"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/text-field";
import { addSong, createPlaylist, deletePlaylist, renamePlaylist } from "@/lib/playlists/api";
import { describePlaylistError, MAX_NAME_LENGTH, MAX_PLAYLISTS, MAX_PLAYLIST_SONGS, validatePlaylistName } from "@/lib/playlists/rules";
import { usePlaylists } from "@/lib/playlists/store";
import { usePlaylistUi } from "@/lib/playlists/ui";
import { useToasts } from "@/lib/ui/toasts";

const toast = (kind: "success" | "warning" | "error", message: string) => useToasts.getState().push(kind, message);
const LIMIT_MESSAGE = `Batas ${MAX_PLAYLISTS} playlist tercapai. Hapus satu playlist untuk membuat yang baru.`;

/**
 * Semua dialog playlist, satu kali di AppShell (dibuka lewat usePlaylistUi dari sidebar, baris lagu, halaman playlist).
 * Dialog tetap terpasang agar fokus kembali ke pemicu saat ditutup; isiannya direset saat dibuka lagi.
 */
export function PlaylistDialogs() {
  return (
    <>
      <NameDialog mode="create" />
      <NameDialog mode="rename" />
      <DeleteDialog />
      <AddDialog />
    </>
  );
}

function NameDialog({ mode }: { mode: "create" | "rename" }) {
  const router = useRouter();
  const dialog = usePlaylistUi((s) => s.dialog);
  const opened = usePlaylistUi((s) => s.opened);
  const count = usePlaylists((s) => s.items.length);
  const open = dialog?.kind === mode;
  const initial = dialog?.kind === "rename" ? dialog.name : "";

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState(0);
  // reset isian tiap dialog dibuka (diturunkan saat render, bukan lewat effect)
  if (open && seen !== opened) {
    setSeen(opened);
    setName(initial);
    setError(null);
    setBusy(false);
  }

  const atLimit = mode === "create" && count >= MAX_PLAYLISTS;
  const close = () => usePlaylistUi.getState().close(mode);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const v = validatePlaylistName(name);
    if (!v.ok) return setError(v.message);
    if (atLimit) return setError(LIMIT_MESSAGE);
    setBusy(true);
    if (mode === "create") {
      const r = await createPlaylist(v.name);
      if (!r.ok) {
        setBusy(false);
        return setError(describePlaylistError(r.error, "create").message);
      }
      usePlaylists.getState().add({ id: r.data.id, name: r.data.name, count: 0 });
      close();
      toast("success", `Playlist “${r.data.name}” dibuat.`);
      router.push(`/playlist/${r.data.id}`);
    } else if (dialog?.kind === "rename") {
      const r = await renamePlaylist(dialog.id, v.name);
      if (!r.ok) {
        setBusy(false);
        return setError(describePlaylistError(r.error, "rename", dialog.name).message);
      }
      usePlaylists.getState().rename(dialog.id, v.name);
      close();
      toast("success", `Nama playlist diganti menjadi “${v.name}”.`);
      router.refresh();
    }
  }

  const formId = `playlist-${mode}-form`;
  return (
    <Dialog
      open={open}
      onClose={close}
      title={mode === "create" ? "Playlist baru" : "Ganti nama playlist"}
      description={mode === "create" ? `Kamu bisa punya sampai ${MAX_PLAYLISTS} playlist (sekarang ${count}).` : undefined}
      actions={
        <>
          <Button variant="ghost" onClick={close}>
            Batal
          </Button>
          <Button type="submit" form={formId} disabled={busy || atLimit}>
            {mode === "create" ? "Buat playlist" : "Simpan"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit}>
        <TextField
          label="Nama playlist"
          value={name}
          maxLength={MAX_NAME_LENGTH + 20}
          autoComplete="off"
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          error={error ?? (atLimit ? LIMIT_MESSAGE : undefined)}
        />
      </form>
    </Dialog>
  );
}

function DeleteDialog() {
  const router = useRouter();
  const dialog = usePlaylistUi((s) => s.dialog);
  const [busy, setBusy] = useState(false);
  const open = dialog?.kind === "delete";
  const close = () => usePlaylistUi.getState().close("delete");

  async function confirm() {
    if (dialog?.kind !== "delete" || busy) return;
    setBusy(true);
    const r = await deletePlaylist(dialog.id);
    setBusy(false);
    if (!r.ok) {
      toast("error", describePlaylistError(r.error, "delete", dialog.name).message);
      return;
    }
    usePlaylists.getState().remove(dialog.id);
    close();
    toast("success", `Playlist “${dialog.name}” dihapus.`);
    router.push("/playlist");
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Hapus playlist?"
      description={dialog?.kind === "delete" ? `“${dialog.name}” akan dihapus permanen. Lagunya sendiri tidak dihapus dari katalog.` : undefined}
      actions={
        <>
          <Button variant="ghost" onClick={close}>
            Batal
          </Button>
          <Button variant="danger" onClick={() => void confirm()} disabled={busy}>
            Hapus playlist
          </Button>
        </>
      }
    />
  );
}

function AddDialog() {
  const dialog = usePlaylistUi((s) => s.dialog);
  const items = usePlaylists((s) => s.items);
  const hydrated = usePlaylists((s) => s.hydrated);
  const [pending, setPending] = useState<string | null>(null);
  const open = dialog?.kind === "add";
  const close = () => usePlaylistUi.getState().close("add");

  async function add(id: string, name: string) {
    if (dialog?.kind !== "add" || pending) return;
    setPending(id);
    const r = await addSong(id, dialog.songId);
    setPending(null);
    if (r.ok) {
      usePlaylists.getState().adjustCount(id, 1);
      close();
      toast("success", `“${dialog.title}” ditambahkan ke “${name}”.`);
      return;
    }
    const d = describePlaylistError(r.error, "add", name);
    if (d.kind === "duplicate") usePlaylistUi.getState().markContained(id); // state lokal usang: tandai, jangan tutup
    toast(d.kind === "error" ? "error" : "warning", d.message);
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Tambahkan ke playlist"
      description={dialog?.kind === "add" ? dialog.title : undefined}
      actions={
        <>
          <Button variant="ghost" onClick={() => usePlaylistUi.getState().openCreate()}>
            Playlist baru
          </Button>
          <Button variant="secondary" onClick={close}>
            Selesai
          </Button>
        </>
      }
    >
      {dialog?.kind === "add" ? (
        !hydrated || dialog.contains === null ? (
          <p className="text-body text-muted">Memuat…</p>
        ) : items.length === 0 ? (
          <p className="text-body text-muted">Kamu belum punya playlist. Buat satu dulu.</p>
        ) : (
          <ul className="grid max-h-72 gap-1 overflow-y-auto">
            {items.map((p) => {
              const has = (dialog.contains ?? []).includes(p.id);
              const full = p.count >= MAX_PLAYLIST_SONGS;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={has || full || pending !== null}
                    onClick={() => void add(p.id, p.name)}
                    className="flex w-full items-center justify-between gap-3 border border-hairline px-3 py-2 text-left text-body hover:bg-raised disabled:text-muted disabled:hover:bg-transparent"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 text-small text-muted">
                      {has ? "Sudah ada di playlist" : full ? `Penuh (${MAX_PLAYLIST_SONGS} lagu)` : `${p.count} lagu`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </Dialog>
  );
}
