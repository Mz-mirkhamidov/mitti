"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * TZ v1 §3 — anon key only, this is the sole browser entry point. Never
 * import lib/supabase/admin.ts from client code (that file throws if
 * bundled client-side, but this is the intended safe door).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
