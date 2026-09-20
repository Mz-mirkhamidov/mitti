import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/day";
import { MenuEditor } from "@/components/rahbar/menu-editor";

interface PageProps {
  searchParams: Promise<{ sana?: string }>;
}

export default async function MenuPage({ searchParams }: PageProps) {
  const user = await requireOwner();
  const { sana } = await searchParams;
  const day = sana && /^\d{4}-\d{2}-\d{2}$/.test(sana) ? sana : today();

  const supabase = await createClient();
  const { data: menu } = await supabase
    .from("menus")
    .select("breakfast, lunch, snack")
    .eq("kindergarten_id", user.kindergartenId)
    .eq("day", day)
    .maybeSingle();

  const lastWeekDay = new Date(`${day}T00:00:00Z`);
  lastWeekDay.setUTCDate(lastWeekDay.getUTCDate() - 7);
  const { data: lastWeekMenu } = await supabase
    .from("menus")
    .select("id")
    .eq("kindergarten_id", user.kindergartenId)
    .eq("day", lastWeekDay.toISOString().slice(0, 10))
    .maybeSingle();

  return (
    <div className="p-4">
      <h1 className="mb-4 text-lg font-semibold text-neutral-900">Menyu</h1>
      <MenuEditor
        kindergartenId={user.kindergartenId}
        day={day}
        initial={{
          breakfast: menu?.breakfast ?? "",
          lunch: menu?.lunch ?? "",
          snack: menu?.snack ?? "",
        }}
        hasLastWeek={!!lastWeekMenu}
      />
    </div>
  );
}
