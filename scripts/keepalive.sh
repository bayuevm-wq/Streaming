#!/usr/bin/env bash
# keepalive.sh: memanggil RPC public.ping() agar proyek Supabase Free tidak di-pause (spec F20).
# Dipakai oleh .github/workflows/keepalive.yml (harian) dan diuji di db-tests terhadap Supabase CLI lokal.
# Variabel: SUPABASE_URL, SUPABASE_ANON_KEY (bukan service role). Bila belum diatur: lewati tanpa error.
set -euo pipefail

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo "::notice::SUPABASE_URL atau SUPABASE_ANON_KEY belum diatur, keep-alive dilewati."
  exit 0
fi

# -f: status non-2xx menggagalkan; 3 percobaan ulang untuk gangguan sementara.
body="$(curl -fsS --retry 3 --retry-delay 5 --retry-all-errors -X POST \
  "${SUPABASE_URL%/}/rest/v1/rpc/ping" \
  -H "apikey: ${SUPABASE_ANON_KEY}" -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" -d '{}')"
echo "ping: ${body}"

if ! echo "${body}" | grep -Eq '"ok" *: *true'; then
  echo "::error::respons ping tidak berisi ok=true"
  exit 1
fi
