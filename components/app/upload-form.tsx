"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status";
import { TextField } from "@/components/ui/text-field";
import type { UploadStatus } from "@/lib/data/library";
import { uploadSong, type Progress } from "@/lib/uploads/client";
import { MESSAGES, TTL_HOURS, validateAudioFile, validateCoverFile, type Problem } from "@/lib/uploads/rules";
import { useToasts } from "@/lib/ui/toasts";

const PHASE_LABEL: Record<Progress["phase"], string> = {
  reserving: "Menyiapkan unggahan…",
  uploading: "Mengunggah…",
  verifying: "Memeriksa berkas…",
};

/**
 * Formulir unggah (spec F5). Cek klien (ekstensi/ukuran) hanya untuk kecepatan; isi file diperiksa server di `finalize`.
 * Tombol dinonaktifkan selama proses agar tak terkirim ganda; kuota 3 lagu dan penyimpanan penuh menonaktifkan formulir.
 */
export function UploadForm({ status }: { status: UploadStatus }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [fileProblem, setFileProblem] = useState<Problem | null>(null);
  const [coverProblem, setCoverProblem] = useState<Problem | null>(null);
  const [failure, setFailure] = useState<Problem | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const busy = useRef(false);

  const quotaFull = status.active >= status.max;
  const closed = !status.storage_open;
  const blocked = quotaFull || closed;
  const working = progress !== null;

  function pickFile(f: File | null) {
    setFile(f);
    setFailure(null);
    setFileProblem(f ? validateAudioFile(f) : null);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }
  function pickCover(f: File | null) {
    setCover(f);
    setCoverProblem(f ? validateCoverFile(f) : null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy.current || blocked || !file) return;
    if (fileProblem || coverProblem) return;
    busy.current = true;
    setFailure(null);
    setProgress({ phase: "reserving", percent: 0 });
    const r = await uploadSong({ file, title, artist, album, cover }, setProgress);
    busy.current = false;
    setProgress(null);
    if (!r.ok) {
      setFailure(r.problem);
      // kuota/penyimpanan berubah di server: muat ulang status agar formulir ikut terkunci bila perlu
      if (r.problem.code === "quota_exceeded" || r.problem.code === "storage_full") router.refresh();
      return;
    }
    useToasts.getState().push("success", `“${title.trim()}” diunggah. Terhapus otomatis dalam ${TTL_HOURS} jam.`);
    router.push("/library");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid max-w-xl gap-6" aria-busy={working}>
      <StatusMessage kind="warning" title="Perlu diketahui">
        Lagu pribadi terhapus otomatis setelah {TTL_HOURS} jam. Unggah hanya musik yang kamu punya haknya.
      </StatusMessage>

      {quotaFull ? (
        <StatusMessage kind="error" title={`Slot penuh (${status.active}/${status.max})`}>
          {MESSAGES.quota_exceeded}
        </StatusMessage>
      ) : null}
      {closed ? (
        <StatusMessage kind="error" title="Upload ditutup sementara">
          {MESSAGES.storage_full}
        </StatusMessage>
      ) : null}

      <fieldset disabled={blocked || working} className="grid gap-5 disabled:opacity-60">
        <div className="grid gap-2">
          <label htmlFor="audio" className="text-small font-semibold text-ink">
            Berkas MP3 (maks 10 MB)
          </label>
          <input
            id="audio"
            type="file"
            accept=".mp3,audio/mpeg"
            aria-describedby={fileProblem ? "audio-error" : undefined}
            aria-invalid={fileProblem ? true : undefined}
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            className="text-body text-ink file:mr-3 file:border file:border-control file:bg-surface file:px-3 file:py-2 file:text-body file:text-ink hover:file:bg-raised"
          />
          {fileProblem ? (
            <p id="audio-error" role="alert" className="text-small text-error">
              {fileProblem.message}
            </p>
          ) : null}
        </div>
        <TextField label="Judul" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required autoComplete="off" />
        <TextField label="Artis" value={artist} onChange={(e) => setArtist(e.target.value)} maxLength={120} required autoComplete="off" />
        <TextField label="Album (opsional)" value={album} onChange={(e) => setAlbum(e.target.value)} maxLength={120} autoComplete="off" />
        <div className="grid gap-2">
          <label htmlFor="cover" className="text-small font-semibold text-ink">
            Sampul (opsional; JPG, PNG, atau WebP, maks 2 MB)
          </label>
          <input
            id="cover"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            aria-describedby={coverProblem ? "cover-error" : undefined}
            onChange={(e) => pickCover(e.target.files?.[0] ?? null)}
            className="text-body text-ink file:mr-3 file:border file:border-control file:bg-surface file:px-3 file:py-2 file:text-body file:text-ink hover:file:bg-raised"
          />
          {coverProblem ? (
            <p id="cover-error" role="alert" className="text-small text-error">
              {coverProblem.message}
            </p>
          ) : null}
        </div>
      </fieldset>

      {progress ? (
        <div className="grid gap-2">
          <p className="text-small text-muted" aria-live="polite">
            {PHASE_LABEL[progress.phase]} {progress.phase === "uploading" ? `${progress.percent}%` : ""}
          </p>
          <div
            role="progressbar"
            aria-label="Kemajuan unggahan"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percent}
            className="h-2 w-full bg-control"
          >
            <div className="h-full origin-left bg-accent" style={{ transform: `scaleX(${progress.percent / 100})` }} />
          </div>
        </div>
      ) : null}

      {failure ? (
        <StatusMessage kind="error" title="Unggahan gagal">
          <span data-testid="upload-error" data-code={failure.code}>
            {failure.message}
          </span>
          {failure.detail ? <span className="mt-1 block text-caption text-muted">Kode teknis: {failure.detail}</span> : null}
        </StatusMessage>
      ) : null}

      <div>
        <Button type="submit" size="lg" disabled={blocked || working || !file || Boolean(fileProblem) || Boolean(coverProblem)}>
          {working ? "Mengunggah…" : "Unggah"}
        </Button>
      </div>
    </form>
  );
}
