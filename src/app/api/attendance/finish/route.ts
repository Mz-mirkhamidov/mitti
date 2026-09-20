import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { currentUserOrNull } from "@/lib/auth";
import { today } from "@/lib/day";
import { maybeSendKitchenReport } from "@/lib/kitchen-report";

/**
 * TZ v1 §7.2, §8 — "Kelmaganlarni yakunlash": everyone in the group with
 * no attendance row yet becomes `absent`, then this is one of the two
 * triggers for the kitchen's daily portion count (the other is the
 * 08:30 cron). Scoped to one group — a teacher only ever sees their own.
 */
export const POST = async (request: Request) => {
  const user = await currentUserOrNull();
  if (!user) return NextResponse.json({ error: "Kirish talab qilinadi." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const groupId = body?.group_id;
  if (typeof groupId !== "string" || !groupId) {
    return NextResponse.json({ error: "group_id kerak." }, { status: 400 });
  }

  const supabase = await createClient();
  const day = today();

  const { data: children } = await supabase
    .from("children")
    .select("id")
    .eq("kindergarten_id", user.kindergartenId)
    .eq("group_id", groupId)
    .eq("active", true);

  const childIds = (children ?? []).map((c) => c.id);
  if (childIds.length === 0) {
    return NextResponse.json({ marked_absent: 0 });
  }

  const { data: existing } = await supabase
    .from("attendance")
    .select("child_id")
    .eq("day", day)
    .in("child_id", childIds);
  const alreadyMarked = new Set((existing ?? []).map((r) => r.child_id));

  const toMark = childIds.filter((id) => !alreadyMarked.has(id));

  if (toMark.length > 0) {
    const { error } = await supabase.from("attendance").upsert(
      toMark.map((childId) => ({
        kindergarten_id: user.kindergartenId,
        child_id: childId,
        day,
        status: "absent" as const,
        absence_reason: "unexcused" as const,
        marked_by: user.id,
      })),
      { onConflict: "child_id,day", ignoreDuplicates: true },
    );
    if (error) {
      console.error("attendance_finish_error", error);
      return NextResponse.json({ error: "Yakunlab bo'lmadi." }, { status: 400 });
    }
  }

  await maybeSendKitchenReport(supabase, user.kindergartenId, day);

  return NextResponse.json({ marked_absent: toMark.length });
};
