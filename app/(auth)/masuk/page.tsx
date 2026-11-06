import type { Metadata } from "next";
import { AnonymousSignIn } from "@/components/auth/anonymous-sign-in";

export const metadata: Metadata = { title: "Masuk — Streaming" };

export default function Page() {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-sm content-center gap-8 px-4 py-12">
      <div className="grid gap-3 border-t-2 border-accent pt-4">
        <h1 className="font-display text-hero font-medium italic tracking-tight text-ink">Streaming</h1>
        <p className="text-lead text-muted">Dengarkan musik, buat playlist, dan simpan lagu favoritmu.</p>
      </div>
      <AnonymousSignIn />
    </main>
  );
}
