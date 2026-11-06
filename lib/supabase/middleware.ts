import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "./env";

// Di Next.js 16 "middleware" bernama Proxy (file `proxy.ts` di root memanggil fungsi ini).
const PUBLIC_PATHS = ["/masuk", "/gaya"]; // /gaya: halaman review design system (statis, tanpa data)

function redirectKeepingCookies(url: URL, from: NextResponse) {
  const res = NextResponse.redirect(url);
  from.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = publicEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Memverifikasi JWT dan menyegarkan sesi bila hampir habis. Jangan menaruh logika di antara
  // createServerClient dan getClaims.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!signedIn && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    const to = request.nextUrl.clone();
    to.pathname = "/masuk";
    to.search = "";
    return redirectKeepingCookies(to, response);
  }
  if (signedIn && pathname === "/masuk") {
    const to = request.nextUrl.clone();
    to.pathname = "/";
    to.search = "";
    return redirectKeepingCookies(to, response);
  }
  return response;
}
