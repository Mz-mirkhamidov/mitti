-- TZ v1 §7.6 lists "Bog'cha nomi" as an editable field on
-- /rahbar/sozlamalar, but 0001_init.sql only granted `kg_read` (select) —
-- no policy at all means RLS denies every write by default, so an owner
-- could never actually rename their own kindergarten. UPDATE only:
-- there is no self-signup path that would need INSERT, and DELETE has
-- no UI anywhere in this spec.

create policy kg_owner_update on public.kindergartens
  for update using (id = public.current_kg_id() and public.current_user_role() = 'owner')
  with check (id = public.current_kg_id());
