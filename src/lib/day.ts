import { formatInTimeZone } from "date-fns-tz";

/**
 * TZ v1 §11 — every `attendance.day` value must come from here.
 * `new Date().toISOString().slice(0,10)` is UTC and gives the wrong
 * calendar date for anything after ~19:00 Tashkent time.
 */
export const TZ = "Asia/Tashkent";

export const today = () => formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");

export const dayOf = (d: Date) => formatInTimeZone(d, TZ, "yyyy-MM-dd");

export const timeOf = (d: Date) => formatInTimeZone(d, TZ, "HH:mm");

/**
 * Monday through today (inclusive), as YYYY-MM-DD strings — used by the
 * Friday 17:00 weekly summary (TZ §9.5). `today` defaults to the real
 * `today()` but takes a parameter so it can be tested against a fixed
 * date.
 */
export function weekSoFar(referenceDay: string = today()): string[] {
  const ref = new Date(`${referenceDay}T00:00:00Z`);
  const isoWeekday = ref.getUTCDay() === 0 ? 7 : ref.getUTCDay(); // 1=Mon .. 7=Sun
  const monday = new Date(ref);
  monday.setUTCDate(ref.getUTCDate() - (isoWeekday - 1));

  const days: string[] = [];
  for (let d = new Date(monday); d <= ref; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}
