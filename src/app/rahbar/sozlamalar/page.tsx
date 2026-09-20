import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { KindergartenSettings } from "@/components/rahbar/kindergarten-settings";
import { TeachersManager } from "@/components/rahbar/teachers-manager";

export default async function SettingsPage() {
  const user = await requireOwner();
  const supabase = await createClient();

  const [{ data: kg }, { data: settings }, { data: teachers }] = await Promise.all([
    supabase.from("kindergartens").select("name").eq("id", user.kindergartenId).maybeSingle(),
    supabase
      .from("settings")
      .select("meal_norm_per_day, kitchen_chat_id")
      .eq("kindergarten_id", user.kindergartenId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id, full_name, phone, active")
      .eq("kindergarten_id", user.kindergartenId)
      .eq("role", "teacher")
      .order("full_name", { ascending: true }),
  ]);

  return (
    <div className="flex flex-col gap-6 p-4">
      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-500">Bog&apos;cha</h2>
        <KindergartenSettings
          kindergartenId={user.kindergartenId}
          initialName={kg?.name ?? ""}
          initialMealNorm={Number(settings?.meal_norm_per_day ?? 0)}
          initialKitchenChatId={settings?.kitchen_chat_id ?? null}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-500">Tarbiyachilar</h2>
        <TeachersManager teachers={teachers ?? []} />
      </section>
    </div>
  );
}
