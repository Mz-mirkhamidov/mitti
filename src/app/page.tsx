import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * TZ v1 §5 — the role-based landing gate. Not a page of its own: a
 * signed-out visitor goes to /login, an `owner` to /rahbar, a `teacher`
 * to /yoqlama. This is also where /login's client-side sign-in lands
 * (`router.push("/")`), so the redirect target is always decided
 * server-side, never trusted from the client.
 */
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (!profile) redirect("/login");

  redirect(profile.role === "owner" ? "/rahbar" : "/yoqlama");
}
