import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  kindergartenId: string;
  fullName: string;
  phone: string;
  role: "owner" | "teacher";
}

/**
 * TZ v1 §5 — the server-side gate every protected page and API route goes
 * through. `middleware.ts` only refreshes the session cookie; it does not
 * check roles, so `/rahbar` being closed to teachers has to be enforced
 * here, not just by hiding the link in the UI.
 */
export async function requireUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("kindergarten_id, full_name, phone, role")
    .eq("id", user.id)
    .eq("active", true)
    .maybeSingle();

  // No active profile — either never provisioned or deactivated by the
  // owner. Either way this account has no bog'cha to see.
  if (!profile) redirect("/login");

  return {
    id: user.id,
    kindergartenId: profile.kindergarten_id,
    fullName: profile.full_name,
    phone: profile.phone,
    role: profile.role as "owner" | "teacher",
  };
}

/** For /rahbar/* pages — teachers get redirected, not just blocked. */
export async function requireOwner(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "owner") redirect("/yoqlama");
  return user;
}

/**
 * API route variant of requireUser(): `redirect()` from next/navigation
 * produces an HTTP redirect, which is the right thing for a page but
 * wrong for a `fetch()` call from client JS (it would resolve to the
 * /login HTML page instead of the JSON error the caller expects). Route
 * handlers check this and return their own 401/403 JSON.
 */
export async function currentUserOrNull(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("kindergarten_id, full_name, phone, role")
    .eq("id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (!profile) return null;

  return {
    id: user.id,
    kindergartenId: profile.kindergarten_id,
    fullName: profile.full_name,
    phone: profile.phone,
    role: profile.role as "owner" | "teacher",
  };
}
