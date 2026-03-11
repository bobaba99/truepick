-- Fix handle_new_user() to handle email UNIQUE conflict.
-- When a user signs in via OAuth (e.g., Google) and their auth.users row was
-- previously deleted/recreated with a new UUID, the trigger tries to INSERT a
-- new public.users row with the same email but a different id.
-- The ON CONFLICT (id) clause doesn't match (new UUID), so the UNIQUE(email)
-- constraint fails with "Database error saving new user".
--
-- Fix: use ON CONFLICT on the email column to update the existing row's id
-- to match the new auth.users UUID.

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

  -- First try: upsert by id (same auth user returning).
  -- If that would violate the email UNIQUE constraint (different auth UUID,
  -- same email), catch the error and update by email instead.
  begin
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
  exception
    when unique_violation then
      -- Email already exists with a different id — re-point the row to the
      -- new auth UUID so RLS policies (auth.uid() = id) keep working.
      update public.users
      set id = new.id,
          last_active = now()
      where email = new.email;
  end;

  return new;
end;
$$;
