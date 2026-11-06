"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status";

type Status = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string };

// Memetakan galat Auth/jaringan menjadi pesan yang jelas (F1). Tidak ada percobaan ulang otomatis.
function messageFor(error: unknown): string {
  const e = error as { status?: number; code?: string; message?: string } | undefined;
  if (e?.status === 429 || e?.code === "over_request_rate_limit") {
    return "Terlalu banyak percobaan masuk. Tunggu beberapa saat, lalu coba lagi.";
  }
  if (e?.code === "captcha_failed" || e?.message === "captcha") {
    return "Verifikasi keamanan gagal. Coba lagi.";
  }
  if (e instanceof TypeError || e?.message?.toLowerCase().includes("fetch")) {
    return "Tidak dapat terhubung ke server. Periksa koneksi internet, lalu coba lagi.";
  }
  return "Gagal masuk. Coba lagi.";
}

export function AnonymousSignIn() {
  const router = useRouter();
  const turnstile = useRef<TurnstileInstance>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Widget Turnstile dimuat dari skrip Cloudflare. Sebelum siap, execute() tidak melakukan apa-apa dan permintaan Auth
  // tidak pernah terkirim (ditemukan lewat uji E2E), jadi tombol dinonaktifkan sampai widget benar-benar terpasang.
  const [widgetReady, setWidgetReady] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  async function signIn() {
    if (status.kind === "loading" || !widgetReady) return; // cegah klik ganda dan klik sebelum siap
    setStatus({ kind: "loading" });
    try {
      // Widget berjalan "execute": token hanya diminta saat tombol ditekan, tanpa tantangan bila tak diperlukan.
      turnstile.current?.reset();
      turnstile.current?.execute();
      const captchaToken = await turnstile.current?.getResponsePromise(20_000);
      if (!captchaToken) throw new Error("captcha");

      const supabase = createClient();
      const { error } = await supabase.auth.signInAnonymously({ options: { captchaToken } });
      if (error) throw error;

      router.replace("/");
      router.refresh();
    } catch (error) {
      turnstile.current?.reset();
      setStatus({ kind: "error", message: messageFor(error) });
    }
  }

  if (!siteKey) {
    return (
      <StatusMessage kind="error" title="Konfigurasi belum lengkap">
        NEXT_PUBLIC_TURNSTILE_SITE_KEY belum diatur (lihat .env.example).
      </StatusMessage>
    );
  }

  const busy = status.kind === "loading" || !widgetReady;
  const label = !widgetReady ? "Menyiapkan" : status.kind === "loading" ? "Memverifikasi" : status.kind === "error" ? "Coba lagi" : "Coba tanpa daftar";

  return (
    <div className="grid gap-4">
      <Button size="lg" onClick={signIn} loading={busy} className="w-full">
        {label}
      </Button>

      {status.kind === "error" && <StatusMessage kind="error" title="Tidak bisa masuk">{status.message}</StatusMessage>}

      <Turnstile
        ref={turnstile}
        siteKey={siteKey}
        options={{ execution: "execute", appearance: "interaction-only" }}
        onWidgetLoad={() => setWidgetReady(true)}
        onError={() => {
          setStatus({ kind: "error", message: "Verifikasi keamanan gagal dimuat. Muat ulang halaman, lalu coba lagi." });
        }}
      />

      <p className="text-small text-muted">Mode tamu: data dihapus otomatis setelah 7 hari tidak aktif.</p>
    </div>
  );
}
