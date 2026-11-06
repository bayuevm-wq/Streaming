// Edge Function `cleanup` (Deno): dipicu pg_cron lewat pg_net (supabase/migrations/0005_cron.sql).
// Deploy: supabase functions deploy cleanup --no-verify-jwt   (memakai rahasia sendiri, bukan JWT)
// Env: SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY (disediakan runtime), CLEANUP_SECRET (supabase secrets set).
import { createClient } from "@supabase/supabase-js";
import { isTask, runTask, safeEqual } from "./logic.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  const secret = Deno.env.get("CLEANUP_SECRET");
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return new Response("forbidden", { status: 403 });
  }
  const task = new URL(req.url).searchParams.get("task") ?? "";
  if (!isTask(task)) return Response.json({ error: "task tidak dikenal" }, { status: 400 });
  const { status, body } = await runTask(db, task);
  return Response.json(body, { status });
});
