-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Enums
create type purchase_source as enum ('email', 'ocr', 'manual');
create type swipe_outcome as enum ('satisfied', 'regret');
create type swipe_timing as enum ('immediate', 'week', 'month3', 'month6');
create type user_value_type as enum (
  'durability',
  'efficiency',
  'aesthetics',
  'interpersonal_value',
  'emotional_value'
);
create type ocr_status as enum ('pending', 'processing', 'completed', 'failed');
create type verdict_outcome as enum ('bought', 'hold', 'skip');

-- Users and onboarding
create table users (
  id uuid primary key default gen_random_uuid(),
  email varchar(255) unique not null,
  created_at timestamp default now(),
  last_active timestamp,
  onboarding_completed boolean default false
);

create table user_values (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  value_type user_value_type not null, -- 'durability', 'efficiency', 'aesthetics', 'interpersonal_value', 'emotional_value'
  preference_score int check (preference_score between 1 and 5),
  created_at timestamp default now(),
  unique(user_id, value_type)
);

-- Purchases and feedback loop
create table purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  title varchar(500) not null,
  price decimal(10,2) not null,
  vendor varchar(255),
  vendor_tier int check (vendor_tier between 0 and 3), -- 0: luxury, 1: premium, 2: mid-tier, 3: generic
  category varchar(100), -- LLM-determined enum
  purchase_date date not null,
  source varchar(20) check (source in ('email', 'ocr', 'manual', 'verdict')),
  verdict_id uuid, -- links to verdict if source='verdict', FK added after verdicts table
  order_id varchar(255), -- for deduplication
  created_at timestamp default now(),
  unique(user_id, vendor, order_id) -- prevent duplicate imports
);

create table swipe_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  purchase_id uuid references purchases(id) on delete cascade,
  timing swipe_timing not null,
  scheduled_for date not null,
  completed_at timestamp,
  created_at timestamp default now(),
  unique(user_id, purchase_id, timing)
);

create table swipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  purchase_id uuid references purchases(id) on delete cascade,
  schedule_id uuid references swipe_schedules(id) on delete cascade,
  timing swipe_timing not null,
  outcome varchar(20) check (outcome in ('satisfied', 'regret')) not null,
  created_at timestamp default now(),
  unique(user_id, purchase_id, timing),
  unique(schedule_id)
);

-- Pre-aggregated insights for fast pattern display.
-- Updated via periodic batch job or trigger.
-- Tracks regret probability across multiple dimensions (e.g., "Electronics over $200: 71% regret").
-- Bayesian smoothing applied to handle small sample sizes.
create table purchase_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  dimension_type varchar(50) not null, -- 'category', 'vendor', 'price_range', 'vendor_tier'
  dimension_value varchar(255) not null,
  total_purchases int default 0,
  total_swipes int default 0,
  regret_count int default 0,
  satisfied_count int default 0,
  regret_rate decimal(5,4), -- 0.6842 = 68.42%
  last_updated timestamp default now(),
  unique(user_id, dimension_type, dimension_value)
);

create table verdicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  candidate_title varchar(500) not null,
  candidate_price decimal(10,2),
  candidate_category varchar(100),
  candidate_vendor varchar(255),
  justification text, -- user's stated reason for considering purchase
  predicted_outcome varchar(20) check (predicted_outcome in ('buy', 'hold', 'skip')),
  confidence_score decimal(5,4), -- 0.0 to 1.0
  reasoning jsonb, -- explainability: which patterns influenced verdict
  hold_release_at timestamp, -- when 24h hold expires
  user_proceeded boolean, -- did they buy despite red/yellow?
  actual_outcome varchar(20) check (actual_outcome in ('satisfied', 'regret')), -- post-purchase swipe
  user_decision varchar(20) check (user_decision in ('bought', 'hold', 'skip')), -- user's actual decision
  user_hold_until timestamp, -- when user's self-imposed hold expires
  created_at timestamp default now()
);

create table hold_timers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  verdict_id uuid references verdicts(id) on delete cascade,
  expires_at timestamp not null,
  notified boolean default false, -- push notification sent?
  created_at timestamp default now()
);

-- Add FK from purchases to verdicts (defined after verdicts table exists)
-- ON DELETE SET NULL: if verdict is deleted, purchase remains but loses the link
alter table purchases
  add constraint fk_purchases_verdict
  foreign key (verdict_id) references verdicts(id) on delete set null;

-- Index for finding purchase by verdict_id
create index idx_purchases_verdict on purchases(verdict_id) where verdict_id is not null;

-- Unique constraint: one purchase per verdict (prevents duplicates when marking verdict as 'bought')
create unique index idx_purchases_verdict_unique on purchases(verdict_id) where verdict_id is not null;

-- Ingestion: email + OCR
-- Store encrypted OAuth credentials for email receipt ingestion.
-- Single connection per user. last_sync enables incremental imports rather than full scans.
create table email_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade unique,
  provider varchar(50) not null, -- 'gmail', 'outlook', etc.
  encrypted_token text not null, -- encrypted OAuth token
  refresh_token text, -- encrypted
  token_expires_at timestamp,
  last_sync timestamp,
  is_active boolean default true,
  created_at timestamp default now()
);

-- Whitelist and pattern-matching for receipt extraction.
-- Maintains vendor classification database.
-- Supports bulk updates when adding new retail categories.
create table email_vendors (
  id uuid primary key default gen_random_uuid(),
  vendor_name varchar(255) unique not null,
  email_patterns text[], -- ['noreply@amazon.com', '%@marketplace.amazon.com']
  is_whitelisted boolean default true,
  default_category varchar(100),
  vendor_tier int check (vendor_tier between 0 and 3)
);

create table ocr_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  image_hash varchar(64) unique, -- SHA-256 to prevent duplicate uploads
  status varchar(20) check (status in ('pending', 'processing', 'completed', 'failed')),
  extracted_data jsonb, -- raw OCR output before user confirmation
  error_message text,
  created_at timestamp default now(),
  processed_at timestamp
);

-- Indexes
-- High-frequency queries
create index idx_purchases_user_date on purchases(user_id, purchase_date desc);
create index idx_swipe_schedules_due on swipe_schedules(user_id, scheduled_for) where completed_at is null;
create index idx_swipes_user_created on swipes(user_id, created_at desc);
create index idx_verdicts_user_created on verdicts(user_id, created_at desc);
create index idx_verdicts_user_hold on verdicts(user_id, user_hold_until)
  where user_decision = 'hold' and user_hold_until is not null;
create index idx_hold_timers_expires on hold_timers(expires_at) where notified = false;

-- Pattern aggregation
create index idx_purchases_category on purchases(user_id, category);
create index idx_purchases_vendor_tier on purchases(user_id, vendor_tier);

-- Email sync
create index idx_email_connections_active on email_connections(user_id) where is_active = true;

-- Row Level Security (RLS)
alter table users enable row level security;

-- Allow users to read their own profile row
create policy "users_select_own"
  on users
  for select
  using (auth.uid() = id);

-- Allow users to insert their own profile row
create policy "users_insert_own"
  on users
  for insert
  with check (auth.uid() = id);

-- Allow users to update their own profile row
create policy "users_update_own"
  on users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Purchases RLS
alter table purchases enable row level security;

create policy "purchases_select_own"
  on purchases
  for select
  using (auth.uid() = user_id);

create policy "purchases_insert_own"
  on purchases
  for insert
  with check (auth.uid() = user_id);

create policy "purchases_update_own"
  on purchases
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "purchases_delete_own"
  on purchases
  for delete
  using (auth.uid() = user_id);

-- User values RLS
alter table user_values enable row level security;

create policy "user_values_select_own"
  on user_values
  for select
  using (auth.uid() = user_id);

create policy "user_values_insert_own"
  on user_values
  for insert
  with check (auth.uid() = user_id);

create policy "user_values_update_own"
  on user_values
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_values_delete_own"
  on user_values
  for delete
  using (auth.uid() = user_id);

-- Swipe schedules RLS
alter table swipe_schedules enable row level security;

create policy "swipe_schedules_select_own"
  on swipe_schedules
  for select
  using (auth.uid() = user_id);

create policy "swipe_schedules_insert_own"
  on swipe_schedules
  for insert
  with check (auth.uid() = user_id);

create policy "swipe_schedules_update_own"
  on swipe_schedules
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "swipe_schedules_delete_own"
  on swipe_schedules
  for delete
  using (auth.uid() = user_id);

-- Swipes RLS
alter table swipes enable row level security;

create policy "swipes_select_own"
  on swipes
  for select
  using (auth.uid() = user_id);

create policy "swipes_insert_own"
  on swipes
  for insert
  with check (auth.uid() = user_id);

create policy "swipes_update_own"
  on swipes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "swipes_delete_own"
  on swipes
  for delete
  using (auth.uid() = user_id);

-- Purchase stats RLS
alter table purchase_stats enable row level security;

create policy "purchase_stats_select_own"
  on purchase_stats
  for select
  using (auth.uid() = user_id);

create policy "purchase_stats_insert_own"
  on purchase_stats
  for insert
  with check (auth.uid() = user_id);

create policy "purchase_stats_update_own"
  on purchase_stats
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "purchase_stats_delete_own"
  on purchase_stats
  for delete
  using (auth.uid() = user_id);

-- Verdicts RLS
alter table verdicts enable row level security;

create policy "verdicts_select_own"
  on verdicts
  for select
  using (auth.uid() = user_id);

create policy "verdicts_insert_own"
  on verdicts
  for insert
  with check (auth.uid() = user_id);

create policy "verdicts_update_own"
  on verdicts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "verdicts_delete_own"
  on verdicts
  for delete
  using (auth.uid() = user_id);

-- Hold timers RLS
alter table hold_timers enable row level security;

create policy "hold_timers_select_own"
  on hold_timers
  for select
  using (auth.uid() = user_id);

create policy "hold_timers_insert_own"
  on hold_timers
  for insert
  with check (auth.uid() = user_id);

create policy "hold_timers_update_own"
  on hold_timers
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "hold_timers_delete_own"
  on hold_timers
  for delete
  using (auth.uid() = user_id);

-- Email connections RLS
alter table email_connections enable row level security;

create policy "email_connections_select_own"
  on email_connections
  for select
  using (auth.uid() = user_id);

create policy "email_connections_insert_own"
  on email_connections
  for insert
  with check (auth.uid() = user_id);

create policy "email_connections_update_own"
  on email_connections
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "email_connections_delete_own"
  on email_connections
  for delete
  using (auth.uid() = user_id);

-- OCR jobs RLS
alter table ocr_jobs enable row level security;

create policy "ocr_jobs_select_own"
  on ocr_jobs
  for select
  using (auth.uid() = user_id);

create policy "ocr_jobs_insert_own"
  on ocr_jobs
  for insert
  with check (auth.uid() = user_id);

create policy "ocr_jobs_update_own"
  on ocr_jobs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ocr_jobs_delete_own"
  on ocr_jobs
  for delete
  using (auth.uid() = user_id);

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
  p_verdict_id uuid default null
)
returns purchases
language plpgsql
security invoker
as $$
declare
  new_row purchases;
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
    verdict_id
  )
  values (
    auth.uid(),
    p_title,
    p_price,
    nullif(p_vendor, ''),
    nullif(p_category, ''),
    p_purchase_date,
    p_source,
    p_verdict_id
  )
  on conflict (verdict_id) where verdict_id is not null
  do update set
    title = excluded.title,
    price = excluded.price,
    vendor = excluded.vendor,
    category = excluded.category,
    purchase_date = excluded.purchase_date
  returning * into new_row;

  insert into swipe_schedules (user_id, purchase_id, timing, scheduled_for)
  values
    (auth.uid(), new_row.id, 'immediate'::swipe_timing, new_row.purchase_date),
    (auth.uid(), new_row.id, 'week'::swipe_timing, new_row.purchase_date + interval '7 days'),
    (auth.uid(), new_row.id, 'month3'::swipe_timing, new_row.purchase_date + interval '3 months'),
    (auth.uid(), new_row.id, 'month6'::swipe_timing, new_row.purchase_date + interval '6 months')
  on conflict (user_id, purchase_id, timing) do update
    set scheduled_for = excluded.scheduled_for
    where swipe_schedules.completed_at is null;

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
