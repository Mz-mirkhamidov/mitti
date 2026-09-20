import "server-only";

const API = "https://api.telegram.org/bot";

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan");
  return t;
}

interface TelegramResult {
  ok: boolean;
  blocked: boolean; // 403 — parent blocked the bot; caller logs and moves on
}

/**
 * TZ v1 §9, §17.4/§17.8 — every send here MUST be awaited by the caller
 * (or wrapped in `after()`/`waitUntil`). Vercel functions can freeze
 * right after the HTTP response goes out; a fire-and-forget `fetch` here
 * risks never actually reaching Telegram's servers.
 *
 * A 403 (parent blocked the bot) is swallowed and reported as `blocked`,
 * not thrown — TZ §9's own rule: don't retry, and don't let one blocked
 * parent stop a loop that's messaging the rest of the group.
 */
export async function sendMessage(chatId: number, text: string): Promise<TelegramResult> {
  const res = await fetch(`${API}${token()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (res.status === 403) return { ok: false, blocked: true };
  if (!res.ok) {
    console.error("telegram_send_message_failed", await res.text().catch(() => ""));
    return { ok: false, blocked: false };
  }
  return { ok: true, blocked: false };
}

export async function sendPhoto(
  chatId: number,
  photoUrl: string,
  caption: string,
): Promise<TelegramResult> {
  const res = await fetch(`${API}${token()}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption }),
  });
  if (res.status === 403) return { ok: false, blocked: true };
  if (!res.ok) {
    console.error("telegram_send_photo_failed", await res.text().catch(() => ""));
    return { ok: false, blocked: false };
  }
  return { ok: true, blocked: false };
}

export function setWebhookUrl(): string {
  return `${API}${token()}/setWebhook`;
}
