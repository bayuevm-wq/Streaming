import type { Metadata } from "next";
import { UploadForm } from "@/components/app/upload-form";
import { getUploadStatus } from "@/lib/data/library";

export const metadata: Metadata = { title: "Unggah lagu — Streaming" };

export default async function Page() {
  const status = await getUploadStatus();
  return (
    <div className="grid gap-8 px-6 py-8">
      <header className="grid gap-2">
        <h1 className="font-display text-display font-medium italic">Unggah lagu</h1>
        <p className="text-body text-muted">
          Ke library pribadimu: maksimal {status.max} lagu aktif ({status.active}/{status.max} terpakai), MP3 hingga 10 MB.
        </p>
      </header>
      <UploadForm status={status} />
    </div>
  );
}
