-- Auth-scoped helper functions
create or replace function add_user_value(
  p_value_type user_value_type,
  p_preference_score int
)
returns user_values
language plpgsql
security invoker
as $$
declare
  new_row user_values;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into user_values (user_id, value_type, preference_score)
  values (auth.uid(), p_value_type, p_preference_score)
  returning * into new_row;

  return new_row;
end;
$$;

create or replace function add_purchase(
  p_title text,
  p_price numeric,
  p_vendor text,
  p_category text,
  p_purchase_date date,
  p_source text default 'manual',
  p_verdict_id uuid default null,
  p_is_past_purchase boolean default false,
  p_past_purchase_outcome text default null,
  p_order_id text default null
)
returns purchases
language plpgsql
security invoker
as $$
declare
  new_row purchases;
  v_user_decision text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into purchases (
    user_id,
    title,
    price,
    vendor,
    category,
    purchase_date,
    source,
    verdict_id,
    is_past_purchase,
    past_purchase_outcome,
    order_id
  )
  values (
    auth.uid(),
    p_title,
    p_price,
    nullif(p_vendor, ''),
    nullif(p_category, '')::purchaseCategory,
    p_purchase_date,
    p_source,
    p_verdict_id,
    p_is_past_purchase,
    p_past_purchase_outcome,
    nullif(p_order_id, '')
  )
  on conflict (verdict_id) where verdict_id is not null
  do update set
    title = excluded.title,
    price = excluded.price,
    vendor = excluded.vendor,
    category = excluded.category,
    purchase_date = excluded.purchase_date
  returning * into new_row;

  -- Determine scheduling logic based on purchase type
  -- Past purchases (from email/ocr): single immediate swipe for behavior seeding
  if p_is_past_purchase then
    insert into swipe_schedules (user_id, purchase_id, timing, scheduled_for)
    values
      (auth.uid(), new_row.id, 'immediate'::swipe_timing, new_row.purchase_date)
    on conflict (user_id, purchase_id, timing) do nothing;
  elsif p_source = 'verdict' and p_verdict_id is not null then
    -- Get the user's decision from the verdict
    select user_decision into v_user_decision
    from verdicts
    where id = p_verdict_id and user_id = auth.uid();

    if v_user_decision = 'bought' then
      -- Verdict purchase where user bought: schedule 3 follow-up swipes
      insert into swipe_schedules (user_id, purchase_id, timing, scheduled_for)
      values
        (auth.uid(), new_row.id, 'day3'::swipe_timing, new_row.purchase_date + interval '3 days'),
        (auth.uid(), new_row.id, 'week3'::swipe_timing, new_row.purchase_date + interval '3 weeks'),
        (auth.uid(), new_row.id, 'month3'::swipe_timing, new_row.purchase_date + interval '3 months')
      on conflict (user_id, purchase_id, timing) do update
        set scheduled_for = excluded.scheduled_for
        where swipe_schedules.completed_at is null;
    else
      -- Verdict purchase where user skipped/held: single immediate swipe for "regret not buying"
      insert into swipe_schedules (user_id, purchase_id, timing, scheduled_for)
      values
        (auth.uid(), new_row.id, 'immediate'::swipe_timing, new_row.purchase_date)
      on conflict (user_id, purchase_id, timing) do nothing;
    end if;
  end if;

  return new_row;
end;
$$;

-- Auth user sync: automatically create public.users row when auth user signs up
-- This ensures RLS policies work correctly since they rely on auth.uid() = user_id
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

  return new;
end;
$$;

-- Create trigger on auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Legacy category normalization: experiences -> entertainment
do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    where t.typname = 'purchasecategory' and e.enumlabel = 'experiences'
  ) and not exists (
    select 1
    from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    where t.typname = 'purchasecategory' and e.enumlabel = 'entertainment'
  ) then
    alter type purchaseCategory rename value 'experiences' to 'entertainment';
  end if;
end
$$;

update purchase_stats
set dimension_value = 'entertainment'
where dimension_type = 'category'
  and lower(trim(dimension_value)) = 'experiences';

update resources
set category = 'entertainment'
where lower(trim(category)) = 'experiences';
