import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { today } from "@/lib/day";
import { sendMessage } from "@/lib/telegram";

/**
 * TZ v1 §9.3, 13:05 Tashkent. Note: this cron is described in §9.3 but
 * was missing from §14's own `vercel.json` listing (only kitchen and
 * weekly were there) — added here and in vercel.json to actually
 * deliver the feature the spec describes.
 *
 * Only children marked `present` today, with a linked parent, and only
 * if the day's menu has a `lunch` value — "Menyu kiritilmagan bo'lsa —
 * xabar yuborilmaydi" is explicit in §9.3.
 */
export const GET = async (request: Request) => {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Ruxsat yo'q." }, { status: 401 });
  }

  const admin = createAdminClient();
  const day = today();

  const { data: kindergartens } = await admin.from("kindergartens").select("id");

  let sent = 0;
  for (const kg of kindergartens ?? []) {
    const { data: menu } = await admin
      .from("menus")
      .select("lunch")
      .eq("kindergarten_id", kg.id)
      .eq("day", day)
      .maybeSingle();
    if (!menu?.lunch) continue;

    const { data: present } = await admin
      .from("attendance")
      .select("child_id, children!inner(full_name, parent_chat_id, active)")
      .eq("kindergarten_id", kg.id)
      .eq("day", day)
      .eq("status", "present");

    for (const row of present ?? []) {
      const child = (row as unknown as {
        children: { full_name: string; parent_chat_id: number | null; active: boolean };
      }).children;
      if (!child.parent_chat_id || !child.active) continue;

      const text = `🍲 ${child.full_name} tushlik qildi\n${menu.lunch}`;
      const result = await sendMessage(child.parent_chat_id, text);
      if (result.ok) sent += 1;
    }
  }

  return NextResponse.json({ ok: true, sent });
};
