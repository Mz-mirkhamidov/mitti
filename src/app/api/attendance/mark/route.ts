import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { currentUserOrNull } from "@/lib/auth";
import { today } from "@/lib/day";
import { notifyArrival } from "@/lib/notify-arrival";

/**
 * TZ v1 §10 step 3 — the write that happens the instant a teacher taps a
 * child, before any photo exists. UI updates from this response alone;
 * the photo (if any) follows as a separate call to /photo.
 *
 * Uses `upsert` on `(child_id, day)`, not `insert`: TZ §17.6's own
 * warning — a double-tap (slow network, impatient tap) must not surface
 * a duplicate-key error, and marking present again after an earlier
 * "kelmadi" (re-marking during the same day) is a legitimate correction,
 * not an error.
 */
export const POST = async (request: Request) => {
  const user = await currentUserOrNull();
  if (!user) return NextResponse.json({ error: "Kirish talab qilinadi." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const childId = body?.child_id;
  const noPhoto = body?.no_photo === true;
  if (typeof childId !== "string" || !childId) {
    return NextResponse.json({ error: "child_id kerak." }, { status: 400 });
  }

  const supabase = await createClient();
  const day = today();

  const { data, error } = await supabase
    .from("attendance")
    .upsert(
      {
        kindergarten_id: user.kindergartenId,
        child_id: childId,
        day,
        status: "present",
        arrived_at: new Date().toISOString(),
        absence_reason: null,
        marked_by: user.id,
        // A re-tap (e.g. after an earlier "kelmadi") starts the photo
        // trail over — the old photo, if any, belonged to the record
        // this now overwrites.
        photo_path: null,
        photo_uploaded_at: null,
        parent_notified_at: null,
      },
      { onConflict: "child_id,day" },
    )
    .select("id, arrived_at")
    .single();

  if (error) {
    // RLS denies this write for a child outside the caller's own
    // kindergarten_id (children_read filters what's visible, but a
    // forged child_id from another org would fail here, not earlier).
    console.error("attendance_mark_error", error);
    return NextResponse.json({ error: "Belgilab bo'lmadi." }, { status: 400 });
  }

  // TZ §7.2's "Rasmsiz belgilash" option — no /photo call will ever
  // follow for this record, so the text-only arrival message has to go
  // out right here.
  if (noPhoto) {
    await notifyArrival(supabase, data.id, childId, data.arrived_at, null);
  }

  return NextResponse.json({ attendance_id: data.id, kindergarten_id: user.kindergartenId, day });
};
