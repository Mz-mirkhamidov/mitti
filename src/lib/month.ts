import { formatInTimeZone } from "date-fns-tz";
import { TZ } from "@/lib/day";

/** `today()`'s month, or the caller's own `?oy=YYYY-MM`. */
export function currentMonth(): string {
  return formatInTimeZone(new Date(), TZ, "yyyy-MM");
}

/** Every calendar date in `month` (YYYY-MM) as YYYY-MM-DD strings. */
export function daysInMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(y, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    return `${month}-${day}`;
  });
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const names = [
    "Yanvar",
    "Fevral",
    "Mart",
    "Aprel",
    "May",
    "Iyun",
    "Iyul",
    "Avgust",
    "Sentyabr",
    "Oktyabr",
    "Noyabr",
    "Dekabr",
  ];
  return `${names[m - 1]} ${y}`;
}
