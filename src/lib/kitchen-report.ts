import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMessage } from "@/lib/telegram";

/**
 * TZ v1 §8 — sends the kitchen's daily portion count, whichever trigger
 * reaches it first: a teacher's "Yakunlash" (see /api/attendance/finish)
 * or the 08:30 cron (/api/cron/kitchen). `kitchen_reports_main_uniq`
 * (unique on kindergarten_id+day where kind='main') is the actual guard
 * against sending twice — this function just tries, and a duplicate-key
 * error here means the other trigger already won the race, which is a
 * normal outcome, not a failure.
 */
export async function maybeSendKitchenReport(
  supabase: SupabaseClient,
  kindergartenId: string,
  day: string,
): Promise<void> {
  const { data: settings } = await supabase
    .from("settings")
    .select("kitchen_chat_id, telegram_enabled")
    .eq("kindergarten_id", kindergartenId)
    .maybeSingle();

  if (!settings?.kitchen_chat_id || settings.telegram_enabled === false) return;

  const { data: groups } = await supabase
    .from("groups")
    .select("id, name")
    .eq("kindergarten_id", kindergartenId)
    .order("sort_order", { ascending: true });

  const { data: present } = await supabase
    .from("attendance")
    .select("child_id, children!inner(group_id)")
    .eq("kindergarten_id", kindergartenId)
    .eq("day", day)
    .eq("status", "present");

  const byGroup = new Map<string, number>();
  for (const row of present ?? []) {
    const groupId = (row as unknown as { children: { group_id: string | null } }).children
      .group_id;
    if (!groupId) continue;
    byGroup.set(groupId, (byGroup.get(groupId) ?? 0) + 1);
  }
  const total = present?.length ?? 0;

  const { data: menu } = await supabase
    .from("menus")
    .select("breakfast")
    .eq("kindergarten_id", kindergartenId)
    .eq("day", day)
    .maybeSingle();

  const groupLines = (groups ?? [])
    .filter((g) => byGroup.has(g.id))
    .map((g) => `${g.name}: ${byGroup.get(g.id)}`)
    .join(" · ");

  const text = [
    `🍲 Bugun ${total} porsiya`,
    groupLines,
    "",
    `Nonushta: ${menu?.breakfast ?? "kiritilmagan"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const { error: insertError } = await supabase
    .from("kitchen_reports")
    .insert({ kindergarten_id: kindergartenId, day, portions: total, kind: "main" });

  // 23505 = unique_violation — another trigger already sent this report;
  // don't send the message twice.
  if (insertError) {
    if (insertError.code !== "23505") console.error("kitchen_report_insert_error", insertError);
    return;
  }

  await sendMessage(settings.kitchen_chat_id, text);
}
