/**
 * TZ v1 §15 step 4 — "1 bog'cha, 1 rahbar, 1 tarbiyachi, 1 guruh, 16 bola".
 * Run once against a fresh project: `pnpm tsx scripts/seed.ts`.
 *
 * Deliberately NOT `import`ing from src/lib/supabase/admin.ts: that file
 * has `import "server-only"`, which Next.js resolves for free inside its
 * own build/dev pipeline but which does not exist as an installed
 * package — running this script directly through `tsx` (outside Next)
 * would fail on that import. Duplicating the two-line client creation
 * here is cheaper than fighting module resolution for a one-off script.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY .env.local'da kerak.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const OWNER_PHONE = "+998901234567";
const OWNER_PASSWORD = "sinov1234";
const TEACHER_PHONE = "+998901234568";
const TEACHER_PASSWORD = "sinov1234";

function phoneToEmail(phone: string): string {
  return `${phone.replace(/\D/g, "")}@mitti.local`;
}

const CHILD_NAMES = [
  "Alisher Navoiy",
  "Zuhra Karimova",
  "Bekzod Yusupov",
  "Malika Rashidova",
  "Jasur Tashkentov",
  "Nilufar Ergasheva",
  "Otabek Xolmatov",
  "Sevinch Qodirova",
  "Farrux Sodiqov",
  "Gulnora Mirzaeva",
  "Ravshan Abdullayev",
  "Dilnoza Saidova",
  "Shavkat Nazarov",
  "Feruza Toshpulatova",
  "Ulug'bek Rahimov",
  "Madina Yoldosheva",
];

async function main() {
  console.log("Bog'cha yaratilmoqda...");
  const { data: kg, error: kgError } = await admin
    .from("kindergartens")
    .insert({ name: "Namuna bog'cha" })
    .select("id")
    .single();
  if (kgError || !kg) throw kgError ?? new Error("kindergarten yaratilmadi");

  console.log("Rahbar hisobi yaratilmoqda...");
  const { data: ownerAuth, error: ownerAuthError } = await admin.auth.admin.createUser({
    email: phoneToEmail(OWNER_PHONE),
    password: OWNER_PASSWORD,
    email_confirm: true,
  });
  if (ownerAuthError || !ownerAuth.user) throw ownerAuthError ?? new Error("owner auth yaratilmadi");
  await admin.from("profiles").insert({
    id: ownerAuth.user.id,
    kindergarten_id: kg.id,
    full_name: "Namuna Rahbar",
    phone: OWNER_PHONE,
    role: "owner",
  });

  console.log("Tarbiyachi hisobi yaratilmoqda...");
  const { data: teacherAuth, error: teacherAuthError } = await admin.auth.admin.createUser({
    email: phoneToEmail(TEACHER_PHONE),
    password: TEACHER_PASSWORD,
    email_confirm: true,
  });
  if (teacherAuthError || !teacherAuth.user)
    throw teacherAuthError ?? new Error("teacher auth yaratilmadi");
  await admin.from("profiles").insert({
    id: teacherAuth.user.id,
    kindergarten_id: kg.id,
    full_name: "Namuna Tarbiyachi",
    phone: TEACHER_PHONE,
    role: "teacher",
  });

  console.log("Guruh yaratilmoqda...");
  const { data: group, error: groupError } = await admin
    .from("groups")
    .insert({ kindergarten_id: kg.id, name: "Katta guruh", teacher_id: teacherAuth.user.id })
    .select("id")
    .single();
  if (groupError || !group) throw groupError ?? new Error("guruh yaratilmadi");

  console.log("16 bola yaratilmoqda...");
  const { error: childrenError } = await admin.from("children").insert(
    CHILD_NAMES.map((full_name) => ({
      kindergarten_id: kg.id,
      group_id: group.id,
      full_name,
    })),
  );
  if (childrenError) throw childrenError;

  console.log("Sozlamalar yaratilmoqda...");
  await admin.from("settings").insert({ kindergarten_id: kg.id, meal_norm_per_day: 25000 });

  console.log("\nTayyor. Kirish ma'lumotlari:");
  console.log(`  Rahbar:      ${OWNER_PHONE} / ${OWNER_PASSWORD}`);
  console.log(`  Tarbiyachi:  ${TEACHER_PHONE} / ${TEACHER_PASSWORD}`);
}

main().catch((err) => {
  console.error("Seed xatosi:", err);
  process.exit(1);
});
