import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { maybeSendKitchenReport } from "@/lib/kitchen-report";
import { today } from "@/lib/day";

/**
 * TZ v1 §8, §14 — 08:30 Tashkent (03:30 UTC in vercel.json). This is one
 * of the two triggers for the kitchen report, not the only one: a
 * teacher's "Yakunlash" fires the same code path first if it happens
 * earlier. `maybeSendKitchenReport`'s own unique-index check is what
 * keeps this from double-sending on a kindergarten that already got its
 * report from a teacher this morning.
 */
export const GET = async (request: Request) => {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Ruxsat yo'q." }, { status: 401 });
  }

  const admin = createAdminClient();
  const day = today();

  const { data: kindergartens } = await admin.from("kindergartens").select("id");

  for (const kg of kindergartens ?? []) {
    try {
      await maybeSendKitchenReport(admin, kg.id, day);
    } catch (err) {
      console.error("cron_kitchen_error", { kindergartenId: kg.id, err });
    }
  }

  return NextResponse.json({ ok: true, count: kindergartens?.length ?? 0 });
};
