"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { createClient } from "@/lib/supabase/client";

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
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  async function signIn() {
    if (status.kind === "loading") return; // cegah klik ganda
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
      <p role="alert" className="text-sm text-red-600">
        NEXT_PUBLIC_TURNSTILE_SITE_KEY belum diatur (lihat .env.example).
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={signIn}
        disabled={status.kind === "loading"}
        className="w-full rounded-full bg-emerald-500 px-6 py-3 font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
      >
        {status.kind === "loading" ? "Memverifikasi…" : status.kind === "error" ? "Coba lagi" : "Coba tanpa daftar"}
      </button>

      {status.kind === "error" && (
        <p role="alert" className="text-sm text-red-600">
          {status.message}
        </p>
      )}

      <Turnstile
        ref={turnstile}
        siteKey={siteKey}
        options={{ execution: "execute", appearance: "interaction-only" }}
      />

      <p className="text-center text-xs text-zinc-500">
        Mode tamu — data dihapus otomatis setelah 7 hari tidak aktif.
      </p>
    </div>
  );
}
