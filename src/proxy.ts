import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * TZ v1 §5 — refreshes the Supabase session cookie on every request.
 * Without this, a Server Component's `createClient()` sees a stale
 * access token once it expires and silently treats the user as signed
 * out, even though a valid refresh token still exists.
 *
 * Named `proxy`, not `middleware`: this Next.js version renamed the file
 * convention (middleware.ts -> proxy.ts, function `middleware` -> `proxy`)
 * — see node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Touching getUser() is what actually triggers the refresh.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
