import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { weekSoFar } from "@/lib/day";
import { sendMessage } from "@/lib/telegram";

/**
 * TZ v1 §9.5, §14 — Friday 17:00 Tashkent. One message per linked
 * parent: "Bu hafta {ism} {X} kundan {Y} kun keldi." X is how many
 * weekdays have passed this week (Mon..today, so normally 5 on a
 * Friday), Y is how many of those the child was marked present.
 */
export const GET = async (request: Request) => {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Ruxsat yo'q." }, { status: 401 });
  }

  const admin = createAdminClient();
  const days = weekSoFar();

  const { data: children } = await admin
    .from("children")
    .select("id, full_name, parent_chat_id")
    .eq("active", true)
    .not("parent_chat_id", "is", null);

  let sent = 0;
  for (const child of children ?? []) {
    if (!child.parent_chat_id) continue;

    const { data: rows } = await admin
      .from("attendance")
      .select("day, status")
      .eq("child_id", child.id)
      .in("day", days)
      .eq("status", "present");

    const presentCount = rows?.length ?? 0;
    const text = `Bu hafta ${child.full_name} ${days.length} kundan ${presentCount} kun keldi. Rahmat!`;
    const result = await sendMessage(child.parent_chat_id, text);
    if (result.ok) sent += 1;
  }

  return NextResponse.json({ ok: true, sent, total: children?.length ?? 0 });
};
