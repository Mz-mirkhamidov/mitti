-- TZ v1 §8 — "rahbar 'davlatdan kelgan summa'ni qo'lda kiritadi, farq
-- ko'rsatiladi" needs somewhere to persist that number per month.
-- 0001_init.sql's reference schema didn't include a table for it —
-- everything else in §8 (expected amount) is computed on the fly from
-- `attendance`, but the *received* amount is a fact only the owner
-- knows, so it has to be stored. One row per kindergarten per month.

create table public.subsidy_reports (
  kindergarten_id  uuid not null references public.kindergartens(id) on delete cascade,
  month            date not null, -- always the 1st of the month
  received_amount  numeric(14,2) not null default 0,
  updated_at       timestamptz not null default now(),
  primary key (kindergarten_id, month)
);

alter table public.subsidy_reports enable row level security;

create policy subsidy_read on public.subsidy_reports
  for select using (kindergarten_id = public.current_kg_id());
create policy subsidy_owner_write on public.subsidy_reports
  for all using (kindergarten_id = public.current_kg_id() and public.current_user_role() = 'owner')
  with check (kindergarten_id = public.current_kg_id());
