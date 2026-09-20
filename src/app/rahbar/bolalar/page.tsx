import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ChildrenManager } from "@/components/rahbar/children-manager";

export default async function ChildrenPage() {
  const user = await requireOwner();
  const supabase = await createClient();

  const [{ data: groups }, { data: children }] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name")
      .eq("kindergarten_id", user.kindergartenId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("children")
      .select("id, full_name, group_id, active, parent_linked_at, parent_link_code")
      .eq("kindergarten_id", user.kindergartenId)
      .order("full_name", { ascending: true }),
  ]);

  return (
    <div className="p-4">
      <h1 className="mb-4 text-lg font-semibold text-neutral-900">Bolalar</h1>
      {groups && groups.length > 0 ? (
        <ChildrenManager
          kindergartenId={user.kindergartenId}
          // Read server-side and passed down as a prop — this is a
          // Server Component, so no NEXT_PUBLIC_ prefix is needed here;
          // the value just travels to the client via the prop, not a
          // client-side env lookup.
          botUsername={process.env.TELEGRAM_BOT_USERNAME ?? "mittikids_bot"}
          groups={groups}
          children={children ?? []}
        />
      ) : (
        <p className="text-sm text-neutral-500">
          Avval kamida bitta guruh kerak. Buni hozircha Supabase orqali yarating.
        </p>
      )}
    </div>
  );
}
