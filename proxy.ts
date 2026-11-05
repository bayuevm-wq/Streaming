import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Gerbang login + penyegaran sesi Supabase pada setiap permintaan (docs/architecture.md, 3.1).
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Lewati aset statis dan berkas internal Next.js.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
