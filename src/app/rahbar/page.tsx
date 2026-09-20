import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/day";
import { currentMonth, daysInMonth, monthLabel } from "@/lib/month";
import { MonthlyGrid } from "@/components/rahbar/monthly-grid";
import { SubsidyInput } from "@/components/rahbar/subsidy-input";

interface PageProps {
  searchParams: Promise<{ oy?: string }>;
}

/**
 * TZ v1 §7.3 — "Bugun" + the evidence table + subsidy calc + export, all
 * on one screen. No dashboards, no charts — just the numbers and the
 * proof behind them (§7.3's own "Kirmaydi" line).
 */
export default async function RahbarTodayPage({ searchParams }: PageProps) {
  const user = await requireOwner();
  const { oy } = await searchParams;
  const month = oy && /^\d{4}-\d{2}$/.test(oy) ? oy : currentMonth();
  const supabase = await createClient();
  const day = today();
  const days = daysInMonth(month);
  const monthStart = days[0];
  const monthEnd = days[days.length - 1];

  const [{ data: groups }, { data: children }, { data: settings }, { data: subsidyRow }] =
    await Promise.all([
      supabase
        .from("groups")
        .select("id, name")
        .eq("kindergarten_id", user.kindergartenId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("children")
        .select("id, full_name, group_id")
        .eq("kindergarten_id", user.kindergartenId)
        .eq("active", true)
        .order("full_name", { ascending: true }),
      supabase
        .from("settings")
        .select("meal_norm_per_day")
        .eq("kindergarten_id", user.kindergartenId)
        .maybeSingle(),
      supabase
        .from("subsidy_reports")
        .select("received_amount")
        .eq("kindergarten_id", user.kindergartenId)
        .eq("month", `${month}-01`)
        .maybeSingle(),
    ]);

  const childIds = (children ?? []).map((c) => c.id);

  const { data: monthAttendance } =
    childIds.length > 0
      ? await supabase
          .from("attendance")
          .select("id, child_id, day, status, arrived_at, photo_path")
          .eq("kindergarten_id", user.kindergartenId)
          .gte("day", monthStart)
          .lte("day", monthEnd)
          .in("child_id", childIds)
      : { data: [] };

  const attendanceIds = (monthAttendance ?? []).map((a) => a.id);
  const { data: auditRows } =
    attendanceIds.length > 0
      ? await supabase.from("attendance_audit").select("attendance_id").in("attendance_id", attendanceIds)
      : { data: [] };
  const correctionCounts = new Map<string, number>();
  for (const row of auditRows ?? []) {
    correctionCounts.set(row.attendance_id, (correctionCounts.get(row.attendance_id) ?? 0) + 1);
  }

  const cells: Record<string, Record<string, {
    attendanceId: string;
    status: "present" | "absent";
    photoPath: string | null;
    arrivedAt: string | null;
    correctionCount: number;
  }>> = {};
  let presentDaysThisMonth = 0;
  let todayPresent = 0;
  const byGroupToday = new Map<string, number>();

  for (const row of monthAttendance ?? []) {
    if (!cells[row.child_id]) cells[row.child_id] = {};
    cells[row.child_id][row.day] = {
      attendanceId: row.id,
      status: row.status,
      photoPath: row.photo_path,
      arrivedAt: row.arrived_at,
      correctionCount: correctionCounts.get(row.id) ?? 0,
    };
    if (row.status === "present") {
      presentDaysThisMonth += 1;
      if (row.day === day) {
        todayPresent += 1;
        const child = children?.find((c) => c.id === row.child_id);
        if (child?.group_id) {
          byGroupToday.set(child.group_id, (byGroupToday.get(child.group_id) ?? 0) + 1);
        }
      }
    }
  }

  const mealNorm = settings?.meal_norm_per_day ?? 0;
  const expectedAmount = presentDaysThisMonth * mealNorm;

  return (
    <div className="flex flex-col gap-6 p-4">
      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-500">Bugun</h2>
        <p className="mb-3 text-3xl font-semibold text-neutral-900">
          {todayPresent} / {children?.length ?? 0}
        </p>
        <div className="flex flex-col divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
          {(groups ?? []).map((g) => {
            const groupTotal = (children ?? []).filter((c) => c.group_id === g.id).length;
            return (
              <div key={g.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-neutral-700">{g.name}</span>
                <span className="font-medium text-neutral-900">
                  {byGroupToday.get(g.id) ?? 0} / {groupTotal}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-500">{monthLabel(month)}</h2>
          <a
            href={`/api/export?oy=${month}`}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
          >
            Excel&apos;ga chiqarish
          </a>
        </div>
        <MonthlyGrid children={children ?? []} days={days} cells={cells} />
      </section>

      <section>
        <SubsidyInput
          kindergartenId={user.kindergartenId}
          month={month}
          expectedAmount={expectedAmount}
          initialReceived={Number(subsidyRow?.received_amount ?? 0)}
        />
      </section>

      <div className="flex gap-2 text-xs text-neutral-400">
        {month !== currentMonth() && <Link href="/rahbar">Joriy oyga qaytish</Link>}
      </div>
    </div>
  );
}
