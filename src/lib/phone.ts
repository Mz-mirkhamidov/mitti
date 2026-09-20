/**
 * TZ v1 §5 — Supabase Auth needs an email; the user never sees or types
 * one. Every caller (login form, admin user creation) must go through
 * this so the same phone always maps to the same synthetic address.
 */
export function phoneToEmail(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@mitti.local`;
}

/** Loose validation: enough digits for a real O'zbekiston number (9-15 covers most formats users might type). */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}
