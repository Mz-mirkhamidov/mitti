import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * TZ v1 §5 — SSR session client (anon key, RLS-scoped). `cookies()` is
 * async in this Next.js version, so every caller of this function must
 * itself be async.
 *
 * `setAll` is wrapped in try/catch: it throws when called from a Server
 * Component (cookies are read-only there) — harmless as long as a
 * middleware/route handler elsewhere refreshes the session, which is
 * exactly the pattern @supabase/ssr expects.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — ignore, middleware handles it.
          }
        },
      },
    },
  );
}
