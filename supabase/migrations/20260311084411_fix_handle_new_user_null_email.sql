-- Fix handle_new_user() to skip insert when email is NULL.
-- Anonymous users and Apple "Hide My Email" users have NULL email in auth.users,
-- which violates the NOT NULL constraint on public.users.email and rolls back
-- the entire auth transaction ("Database error saving new user").

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Skip public.users row for anonymous users (no email).
  -- They will get a row when they convert to a permanent account.
  if new.email is null then
    return new;
  end if;

  insert into public.users (id, email, created_at, last_active)
  values (
    new.id,
    new.email,
    now(),
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    last_active = now();

  return new;
end;
$$;

-- Relax NOT NULL on email so future upserts with initially-null email don't fail.
-- The UNIQUE constraint still prevents duplicate emails (NULLs are treated as distinct).
alter table public.users alter column email drop not null;
