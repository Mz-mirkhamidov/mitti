import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { currentUserOrNull } from "@/lib/auth";
import { notifyArrival } from "@/lib/notify-arrival";

/**
 * TZ v1 §10 step 5-6 — called after the client has already uploaded the
 * compressed photo straight to Storage (RLS on storage.objects enforces
 * the path prefix; this route never touches file bytes). Records the
 * path, then sends the arrival notification.
 *
 * The Telegram send is `await`ed, not fire-and-forget — TZ §17.4's own
 * trap: a Vercel function can freeze the instant the response goes out,
 * so an un-awaited `fetch` to Telegram may simply never leave the box.
 */
export const POST = async (request: Request) => {
  const user = await currentUserOrNull();
  if (!user) return NextResponse.json({ error: "Kirish talab qilinadi." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const attendanceId = body?.attendance_id;
  const storagePath = body?.storage_path;
  if (typeof attendanceId !== "string" || typeof storagePath !== "string") {
    return NextResponse.json({ error: "attendance_id va storage_path kerak." }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: record, error: updateError } = await supabase
    .from("attendance")
    .update({ photo_path: storagePath, photo_uploaded_at: new Date().toISOString() })
    .eq("id", attendanceId)
    // RLS's own kindergarten_id check would catch a cross-tenant id, but
    // matching it here too means a genuinely-missing row is a clean 404,
    // not a confusing RLS-shaped 400.
    .eq("kindergarten_id", user.kindergartenId)
    .select("id, child_id, arrived_at, parent_notified_at")
    .maybeSingle();

  if (updateError || !record) {
    console.error("attendance_photo_error", updateError);
    return NextResponse.json({ error: "Yozuv topilmadi." }, { status: 404 });
  }

  if (record.parent_notified_at) {
    // Already notified for this record (e.g. the "no-photo" path fired
    // first) — a photo arriving late must not send a second message.
    return NextResponse.json({ ok: true, notified: false });
  }

  const { notified } = await notifyArrival(
    supabase,
    record.id,
    record.child_id,
    record.arrived_at,
    storagePath,
  );

  return NextResponse.json({ ok: true, notified });
};
