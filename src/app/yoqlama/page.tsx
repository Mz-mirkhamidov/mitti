import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/day";
import { AttendanceScreen } from "@/components/yoqlama/attendance-screen";
import type { AbsenceReason } from "@/lib/types";

interface PageProps {
  searchParams: Promise<{ guruh?: string }>;
}

/**
 * TZ v1 §7.2 — the most important screen. This file only fetches data;
 * all the interaction lives in AttendanceScreen (a Client Component,
 * since every action here has to update the UI before any network call
 * returns).
 */
export default async function YoqlamaPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const { guruh } = await searchParams;
  const supabase = await createClient();

  const groupsQuery = supabase
    .from("groups")
    .select("id, name")
    .eq("kindergarten_id", user.kindergartenId)
    .order("sort_order", { ascending: true });

  const { data: groups } =
    user.role === "teacher" ? await groupsQuery.eq("teacher_id", user.id) : await groupsQuery;

  if (!groups || groups.length === 0) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4 text-center text-neutral-500">
        Sizga hali guruh biriktirilmagan. Rahbaringizga murojaat qiling.
      </div>
    );
  }

  const activeGroup = groups.find((g) => g.id === guruh) ?? groups[0];
  const day = today();

  const { data: children } = await supabase
    .from("children")
    .select("id, full_name")
    .eq("kindergarten_id", user.kindergartenId)
    .eq("group_id", activeGroup.id)
    .eq("active", true)
    .order("full_name", { ascending: true });

  const childIds = (children ?? []).map((c) => c.id);
  const { data: attendanceRows } =
    childIds.length > 0
      ? await supabase
          .from("attendance")
          .select("id, child_id, status, arrived_at, absence_reason")
          .eq("day", day)
          .in("child_id", childIds)
      : { data: [] };

  const initialAttendance: Record<
    string,
    {
      attendanceId: string;
      status: "present" | "absent";
      arrivedAt: string | null;
      absenceReason: AbsenceReason | null;
      hasPhotoQueued: boolean;
    }
  > = {};
  for (const row of attendanceRows ?? []) {
    initialAttendance[row.child_id] = {
      attendanceId: row.id,
      status: row.status,
      arrivedAt: row.arrived_at,
      absenceReason: row.absence_reason,
      hasPhotoQueued: false,
    };
  }

  return (
    <AttendanceScreen
      groupId={activeGroup.id}
      groupName={activeGroup.name}
      kindergartenId={user.kindergartenId}
      day={day}
      children={children ?? []}
      initialAttendance={initialAttendance}
      groups={groups}
    />
  );
}
