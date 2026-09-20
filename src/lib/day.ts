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
