import type { Metadata } from "next";
import { AnonymousSignIn } from "@/components/auth/anonymous-sign-in";

export const metadata: Metadata = { title: "Masuk — Streaming" };

export default function Page() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-8 px-4">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Streaming</h1>
        <p className="text-sm text-zinc-500">Dengarkan musik, buat playlist, dan simpan lagu favoritmu.</p>
      </div>
      <AnonymousSignIn />
    </main>
  );
}
