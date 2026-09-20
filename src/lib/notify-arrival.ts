import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { timeOf } from "@/lib/day";
import { sendPhoto, sendMessage } from "@/lib/telegram";

/**
 * Shared by /api/attendance/mark (the "Rasmsiz belgilash" path — nothing
 * else will ever call /photo for this record, so the text notification
 * has to fire right here) and /api/attendance/photo (the normal path,
 * once the photo is actually uploaded). Both check `parent_notified_at`
 * first so a record can only ever trigger one arrival message — TZ §9's
 * "kuniga ikkitadan ortiq xabar yo'q" rule, applied to this one slot.
 */
export async function notifyArrival(
  supabase: SupabaseClient,
  attendanceId: string,
  childId: string,
  arrivedAt: string | null,
  photoPath: string | null,
): Promise<{ notified: boolean }> {
  const { data: child } = await supabase
    .from("children")
    .select("full_name, parent_chat_id, group_id")
    .eq("id", childId)
    .maybeSingle();

  if (!child?.parent_chat_id) return { notified: false };

  const { data: group } = child.group_id
    ? await supabase.from("groups").select("name").eq("id", child.group_id).maybeSingle()
    : { data: null };

  const time = arrivedAt ? timeOf(new Date(arrivedAt)) : "";
  const caption = `☀️ ${child.full_name} bog'chaga keldi\n${group?.name ?? ""} · ${time}`;

  let result;
  if (photoPath) {
    const { data: signed } = await supabase.storage
      .from("attendance-photos")
      .createSignedUrl(photoPath, 60 * 60);
    result = signed
      ? await sendPhoto(child.parent_chat_id, signed.signedUrl, caption)
      : await sendMessage(child.parent_chat_id, caption);
  } else {
    result = await sendMessage(child.parent_chat_id, caption);
  }

  if (result.ok) {
    await supabase
      .from("attendance")
      .update({ parent_notified_at: new Date().toISOString() })
      .eq("id", attendanceId);
  } else if (result.blocked) {
    console.warn("telegram_parent_blocked", { childId });
  }

  return { notified: result.ok };
}
