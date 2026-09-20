import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { currentUserOrNull } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { currentMonth, daysInMonth } from "@/lib/month";

/**
 * TZ v1 §2, §7.3 — "rahbar oy oxirida Excel fayl ola olsa" is one of
 * exactly four things §2 measures success by. Two sheets: attendance
 * (children x days) and food (daily portion counts + the subsidy
 * comparison from §8), matching TZ §1's "Excel hisobot (davomat + ovqat)".
 */
export const GET = async (request: Request) => {
  const user = await currentUserOrNull();
  if (!user || user.role !== "owner") {
    return NextResponse.json({ error: "Faqat rahbar eksport qila oladi." }, { status: 403 });
  }

  const url = new URL(request.url);
  const monthParam = url.searchParams.get("oy");
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonth();
  const days = daysInMonth(month);

  const supabase = await createClient();

  const [{ data: children }, { data: settings }, { data: subsidy }] = await Promise.all([
    supabase
      .from("children")
      .select("id, full_name")
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
  const { data: attendance } =
    childIds.length > 0
      ? await supabase
          .from("attendance")
          .select("child_id, day, status")
          .eq("kindergarten_id", user.kindergartenId)
          .gte("day", days[0])
          .lte("day", days[days.length - 1])
          .in("child_id", childIds)
      : { data: [] };

  const statusByChildDay = new Map<string, "present" | "absent">();
  for (const row of attendance ?? []) {
    statusByChildDay.set(`${row.child_id}|${row.day}`, row.status);
  }

  // --- Davomat sheet ---
  const attendanceRows: (string | number)[][] = [
    ["Bola", ...days.map((d) => Number(d.slice(-2))), "Jami kun"],
  ];
  const portionsByDay = new Map<string, number>(days.map((d) => [d, 0]));

  for (const child of children ?? []) {
    let total = 0;
    const row: (string | number)[] = [child.full_name];
    for (const day of days) {
      const status = statusByChildDay.get(`${child.id}|${day}`);
      const present = status === "present";
      if (present) {
        total += 1;
        portionsByDay.set(day, (portionsByDay.get(day) ?? 0) + 1);
      }
      row.push(present ? 1 : status === "absent" ? 0 : "");
    }
    row.push(total);
    attendanceRows.push(row);
  }

  // --- Ovqat sheet ---
  const mealNorm = Number(settings?.meal_norm_per_day ?? 0);
  const totalPresentDays = Array.from(portionsByDay.values()).reduce((a, b) => a + b, 0);
  const expectedAmount = totalPresentDays * mealNorm;
  const receivedAmount = Number(subsidy?.received_amount ?? 0);

  const foodRows: (string | number)[][] = [
    ["Sana", "Porsiya soni"],
    ...days.map((d) => [d, portionsByDay.get(d) ?? 0]),
    [],
    ["Ovqat normasi (so'm/kun/bola)", mealNorm],
    ["Jami kelgan kun-bola", totalPresentDays],
    ["Kutilgan summa", expectedAmount],
    ["Davlatdan kelgan summa", receivedAmount],
    ["Farq", receivedAmount - expectedAmount],
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(attendanceRows),
    "Davomat",
  );
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(foodRows), "Ovqat");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="mitti-${month}.xlsx"`,
    },
  });
};
