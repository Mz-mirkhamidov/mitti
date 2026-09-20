import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/telegram";

/**
 * TZ v1 §9.1 — the only webhook this bot needs: `/start <code>` links a
 * parent's chat to a child. Everything else Telegram sends (other
 * commands, stray messages) is acknowledged with 200 and ignored — a
 * webhook must never leave Telegram retrying.
 *
 * `X-Telegram-Bot-Api-Secret-Token` is checked before touching the body:
 * this endpoint uses the service-role client (admin.ts — no user session
 * exists here), so the shared secret is the only thing standing between
 * this route and an unauthenticated write.
 */
export const POST = async (request: Request) => {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = await request.json().catch(() => null);
  const message = update?.message;
  const text: string | undefined = message?.text;
  const chatId: number | undefined = message?.chat?.id;

  if (!text || !chatId || !text.startsWith("/start")) {
    return NextResponse.json({ ok: true });
  }

  const code = text.replace("/start", "").trim();
  if (!code) return NextResponse.json({ ok: true });

  const admin = createAdminClient();

  const { data: child } = await admin
    .from("children")
    .select("id, full_name, parent_link_code")
    .eq("parent_link_code", code)
    .maybeSingle();

  if (!child) {
    await sendMessage(chatId, "Kod topilmadi yoki eskirgan. Rahbaringizdan yangi havola so'rang.");
    return NextResponse.json({ ok: true });
  }

  // The code is single-use: null it out the moment it's consumed, and
  // the update's own WHERE re-checks the code (not just the id) so two
  // /start messages racing for the same code can't both succeed — only
  // whichever one's UPDATE lands first still finds a matching row.
  const { data: linked, error } = await admin
    .from("children")
    .update({ parent_chat_id: chatId, parent_linked_at: new Date().toISOString(), parent_link_code: null })
    .eq("id", child.id)
    .eq("parent_link_code", code)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("telegram_link_error", error);
    return NextResponse.json({ ok: true });
  }
  if (!linked) {
    // Lost the race, or the link was already used by someone else.
    await sendMessage(chatId, "Bu havola allaqachon ishlatilgan.");
    return NextResponse.json({ ok: true });
  }

  await sendMessage(
    chatId,
    `Assalomu alaykum! Siz ${child.full_name}ning ota-onasi sifatida ulandingiz.\n\n` +
      "Har kuni farzandingiz bog'chaga kelganda sizga xabar va surat yuboramiz.\n" +
      "Surat faqat sizga boradi — guruhga emas.",
  );

  return NextResponse.json({ ok: true });
};
