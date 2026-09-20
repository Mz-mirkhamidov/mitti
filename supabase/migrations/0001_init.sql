-- Mitti — 1-bosqich sxemasi
-- Ishga tushirish: Supabase SQL Editor yoki `supabase db push`

create extension if not exists pgcrypto;

-- ============================================================
-- JADVALLAR
-- ============================================================

create table public.kindergartens (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  kindergarten_id uuid not null references public.kindergartens(id) on delete cascade,
  full_name       text not null,
  phone           text not null,
  role            text not null check (role in ('owner','teacher')),
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index profiles_kg_idx on public.profiles (kindergarten_id);

create table public.groups (
  id              uuid primary key default gen_random_uuid(),
  kindergarten_id uuid not null references public.kindergartens(id) on delete cascade,
  name            text not null,
  teacher_id      uuid references public.profiles(id) on delete set null,
  sort_order      int not null default 0
);
create index groups_kg_idx on public.groups (kindergarten_id);

create table public.children (
  id               uuid primary key default gen_random_uuid(),
  kindergarten_id  uuid not null references public.kindergartens(id) on delete cascade,
  group_id         uuid references public.groups(id) on delete set null,
  full_name        text not null,
  monthly_fee      numeric(12,2),          -- 2-bosqichda ishlatiladi
  active           boolean not null default true,
  parent_chat_id   bigint,                 -- Telegram chat id (shaxsiy chat)
  parent_link_code text unique,            -- /start <code> uchun bir martalik kod
  parent_linked_at timestamptz,
  created_at       timestamptz not null default now()
);
create index children_kg_idx   on public.children (kindergarten_id);
create index children_grp_idx  on public.children (group_id) where active;

-- day = Asia/Tashkent bo'yicha kun. UTC'dan hisoblamang.
create table public.attendance (
  id                 uuid primary key default gen_random_uuid(),
  kindergarten_id    uuid not null references public.kindergartens(id) on delete cascade,
  child_id           uuid not null references public.children(id) on delete cascade,
  day                date not null,
  status             text not null check (status in ('present','absent')),
  arrived_at         timestamptz,
  photo_path         text,
  photo_uploaded_at  timestamptz,
  absence_reason     text check (absence_reason in ('sick','vacation','unexcused')),
  marked_by          uuid references public.profiles(id) on delete set null,
  parent_notified_at timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (child_id, day)
);
create index attendance_kg_day_idx on public.attendance (kindergarten_id, day);

-- Dalil jurnalining asosi: har bir o'zgartirish iz qoldiradi.
create table public.attendance_audit (
  id            uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance(id) on delete cascade,
  old_status    text,
  old_arrived_at timestamptz,
  old_reason    text,
  changed_by    uuid references public.profiles(id) on delete set null,
  changed_at    timestamptz not null default now()
);
create index attendance_audit_att_idx on public.attendance_audit (attendance_id);

create table public.menus (
  id              uuid primary key default gen_random_uuid(),
  kindergarten_id uuid not null references public.kindergartens(id) on delete cascade,
  day             date not null,
  breakfast       text,
  lunch           text,
  snack           text,
  unique (kindergarten_id, day)
);

create table public.settings (
  kindergarten_id    uuid primary key references public.kindergartens(id) on delete cascade,
  meal_norm_per_day  numeric(12,2) not null default 0,  -- rahbar kiritadi, biz norma da'vo qilmaymiz
  kitchen_chat_id    bigint,
  portion_report_time time not null default '08:30',
  telegram_enabled   boolean not null default true
);

-- Oshxona xabari ikki marta ketmasligi uchun.
create table public.kitchen_reports (
  id              uuid primary key default gen_random_uuid(),
  kindergarten_id uuid not null references public.kindergartens(id) on delete cascade,
  day             date not null,
  portions        int not null,
  kind            text not null check (kind in ('main','correction')),
  sent_at         timestamptz not null default now()
);
create unique index kitchen_reports_main_uniq
  on public.kitchen_reports (kindergarten_id, day) where kind = 'main';

-- ============================================================
-- updated_at + audit triggerlari
-- ============================================================

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger attendance_touch
  before update on public.attendance
  for each row execute function public.touch_updated_at();

-- security definer: audit yozuvi RLS tomonidan to'sib qo'yilmasligi uchun.
-- attendance_audit jadvalida faqat SELECT siyosati bor (pastga qarang) — agar
-- bu funksiya oddiy INVOKER bo'lganda, har bir davomat o'zgarishi trigger
-- ichida "row-level security policy" xatosi bilan yiqilardi, chunki
-- authenticated rolida attendance_audit'ga INSERT siyosati yo'q.
create or replace function public.log_attendance_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status is distinct from new.status
     or old.arrived_at is distinct from new.arrived_at
     or old.absence_reason is distinct from new.absence_reason then
    insert into public.attendance_audit
      (attendance_id, old_status, old_arrived_at, old_reason, changed_by)
    values (old.id, old.status, old.arrived_at, old.absence_reason, auth.uid());
  end if;
  return new;
end $$;

create trigger attendance_audit_trg
  after update on public.attendance
  for each row execute function public.log_attendance_change();

-- ============================================================
-- RLS yordamchilari
-- ============================================================

create or replace function public.current_kg_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select kindergarten_id from public.profiles where id = auth.uid() and active
$$;

create or replace function public.current_user_role()
returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

-- ============================================================
-- RLS
-- ============================================================

alter table public.kindergartens   enable row level security;
alter table public.profiles        enable row level security;
alter table public.groups          enable row level security;
alter table public.children        enable row level security;
alter table public.attendance      enable row level security;
alter table public.attendance_audit enable row level security;
alter table public.menus           enable row level security;
alter table public.settings        enable row level security;
alter table public.kitchen_reports enable row level security;

create policy kg_read on public.kindergartens
  for select using (id = public.current_kg_id());

create policy profiles_read on public.profiles
  for select using (kindergarten_id = public.current_kg_id());
create policy profiles_owner_write on public.profiles
  for all using (kindergarten_id = public.current_kg_id() and public.current_user_role() = 'owner')
  with check (kindergarten_id = public.current_kg_id());

create policy groups_read on public.groups
  for select using (kindergarten_id = public.current_kg_id());
create policy groups_owner_write on public.groups
  for all using (kindergarten_id = public.current_kg_id() and public.current_user_role() = 'owner')
  with check (kindergarten_id = public.current_kg_id());

create policy children_read on public.children
  for select using (kindergarten_id = public.current_kg_id());
create policy children_owner_write on public.children
  for all using (kindergarten_id = public.current_kg_id() and public.current_user_role() = 'owner')
  with check (kindergarten_id = public.current_kg_id());

-- Tarbiyachi ham, rahbar ham yo'qlama qo'ya oladi va tuzata oladi (tuzatish iz qoldiradi).
create policy attendance_read on public.attendance
  for select using (kindergarten_id = public.current_kg_id());

create policy attendance_insert on public.attendance
  for insert with check (kindergarten_id = public.current_kg_id());

create policy attendance_update on public.attendance
  for update using (kindergarten_id = public.current_kg_id())
  with check (kindergarten_id = public.current_kg_id());

-- O'chirish FAQAT "Bekor qilish" uchun: 10 daqiqadan eski yozuv o'chirilmaydi.
-- Bu "o'zgartirib bo'lmaydigan dalil jurnali" tamoyilining bir qismi (TZ §1,
-- §6) — cheksiz delete ruxsati bo'lganda kimdir eski "kelmadi" yozuvini
-- o'chirib, hech qanday iz qoldirmasdan qayta yarata olardi.
create policy attendance_undo on public.attendance
  for delete using (
    kindergarten_id = public.current_kg_id()
    and created_at > now() - interval '10 minutes'
  );

-- Audit faqat o'qiladi. Yozuvni trigger security definer bilan kiritadi;
-- insert/update/delete siyosati ataylab yo'q — hech kim (owner ham) buni
-- qo'lda o'zgartira olmasligi kerak.
create policy audit_read on public.attendance_audit
  for select using (
    exists (
      select 1 from public.attendance a
      where a.id = public.attendance_audit.attendance_id
        and a.kindergarten_id = public.current_kg_id()
    )
  );

create policy menus_read on public.menus
  for select using (kindergarten_id = public.current_kg_id());
create policy menus_owner_write on public.menus
  for all using (kindergarten_id = public.current_kg_id() and public.current_user_role() = 'owner')
  with check (kindergarten_id = public.current_kg_id());

create policy settings_read on public.settings
  for select using (kindergarten_id = public.current_kg_id());
create policy settings_owner_write on public.settings
  for all using (kindergarten_id = public.current_kg_id() and public.current_user_role() = 'owner')
  with check (kindergarten_id = public.current_kg_id());

create policy kitchen_read on public.kitchen_reports
  for select using (kindergarten_id = public.current_kg_id());

-- ============================================================
-- STORAGE
-- ============================================================
-- Bucket qo'lda yaratiladi: nomi "attendance-photos", public = false.
-- Fayl yo'li: <kindergarten_id>/<YYYY-MM-DD>/<child_id>.jpg

insert into storage.buckets (id, name, public)
values ('attendance-photos', 'attendance-photos', false)
on conflict (id) do nothing;

create policy photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attendance-photos'
    and (storage.foldername(name))[1] = public.current_kg_id()::text
  );

create policy photos_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attendance-photos'
    and (storage.foldername(name))[1] = public.current_kg_id()::text
  );

create policy photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'attendance-photos'
    and (storage.foldername(name))[1] = public.current_kg_id()::text
  );

-- Suratni o'chirish siyosati YO'Q — dalil jurnali o'chirilmasligi kerak.
