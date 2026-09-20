import "server-only";

/**
 * TZ v1 §14 — works for both Vercel's own Cron (which sends this same
 * `Authorization: Bearer <CRON_SECRET>` header automatically when the
 * env var is set) and an external trigger like cron-job.org configured
 * to send the identical header, per TZ's own fallback note.
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
