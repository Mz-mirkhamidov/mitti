import { NextResponse } from "next/server";
import { currentUserOrNull } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { phoneToEmail, isValidPhone } from "@/lib/phone";

/**
 * TZ v1 §5, §7.6 — "Akkaunt yaratish: server tomonda
 * supabase.auth.admin.createUser(...), so'ngra profiles jadvaliga
 * yozuv. Bu yagona joy admin.ts ishlatiladi" (plus the Telegram webhook,
 * which has no user session at all to work with).
 */
export const POST = async (request: Request) => {
  const user = await currentUserOrNull();
  if (!user) return NextResponse.json({ error: "Kirish talab qilinadi." }, { status: 401 });
  if (user.role !== "owner") {
    return NextResponse.json({ error: "Faqat rahbar tarbiyachi qo'sha oladi." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const fullName: string | undefined = body?.full_name?.trim();
  const phone: string | undefined = body?.phone?.trim();
  const password: string | undefined = body?.password;

  if (!fullName || !phone || !isValidPhone(phone)) {
    return NextResponse.json({ error: "Ism va to'g'ri telefon raqami kerak." }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Parol kamida 6 belgi bo'lsin." }, { status: 400 });
  }

  const admin = createAdminClient();
  const email = phoneToEmail(phone);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    // Supabase returns a generic conflict error for an existing email —
    // translate it, since the user only ever sees "phone", never "email".
    const isDuplicate = createError?.message?.toLowerCase().includes("already");
    return NextResponse.json(
      { error: isDuplicate ? "Bu telefon raqami bilan hisob allaqachon bor." : "Hisob yaratilmadi." },
      { status: isDuplicate ? 409 : 500 },
    );
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    kindergarten_id: user.kindergartenId,
    full_name: fullName,
    phone,
    role: "teacher",
  });

  if (profileError) {
    // Roll back the auth user so a failed profile insert doesn't leave a
    // login-capable account with no bog'cha attached to it.
    await admin.auth.admin.deleteUser(created.user.id);
    console.error("teacher_profile_insert_error", profileError);
    return NextResponse.json({ error: "Hisob yaratilmadi." }, { status: 500 });
  }

  return NextResponse.json({ id: created.user.id, full_name: fullName, phone }, { status: 201 });
};
