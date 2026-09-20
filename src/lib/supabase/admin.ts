import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * TZ v1 §12 — the ONLY file allowed to touch SUPABASE_SERVICE_ROLE_KEY.
 * Bypasses RLS entirely, so every call site here must apply its own
 * `kindergarten_id` filter by hand — there is no policy backing it up.
 * Used for: creating auth users (rahbar adds a teacher), Telegram webhook
 * writes (no user session), and cron jobs.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
