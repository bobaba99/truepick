-- Users and onboarding
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamp default now(),
  last_active timestamp,
  onboarding_completed boolean default false,
  profile_summary text,
  onboarding_answers jsonb, -- coreValues, regretPatterns, satisfactionPatterns, decisionStyle, neuroticismScore, materialism, locusOfControl, identityStability
  weekly_fun_budget decimal(10,2) check (weekly_fun_budget >= 0)
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
  title text not null,
  price decimal(10,2) not null,
  vendor text,
  vendor_id int, -- optional FK to vendors when matched
  vendor_tier int check (vendor_tier between 0 and 3), -- 0: luxury, 1: premium, 2: mid-tier, 3: generic
  category purchaseCategory, -- LLM-determined enum
  purchase_date date not null,
  source text check (source in ('email', 'email:gmail', 'email:outlook', 'ocr', 'manual', 'verdict')),
  verdict_id uuid, -- links to verdict if source='verdict', FK added after verdicts table
  order_id text, -- for deduplication
  is_past_purchase boolean default false, -- marks seed/manually-added past purchases
  past_purchase_outcome text check (past_purchase_outcome in ('satisfied', 'regret', 'not_sure')), -- direct outcome for past purchases
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
  outcome text check (outcome in ('satisfied', 'regret', 'not_sure')) not null,
  rated_at timestamp default now(),
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
  dimension_type purchaseStatsDimensionType not null, -- 'category', 'vendor', 'price_range', 'vendor_tier'
  dimension_value text not null,
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
  candidate_title text not null,
  candidate_price decimal(10,2),
  candidate_category purchaseCategory,
  candidate_vendor text,
  candidate_vendor_id int, -- optional FK to vendors when matched
  scoring_model text check (scoring_model in ('standard', 'cost_sensitive_iso', 'llm_only')) default 'standard',
  justification text, -- user's stated reason for considering purchase
  predicted_outcome text check (predicted_outcome in ('buy', 'hold', 'skip')),
  confidence_score decimal(5,4), -- 0.0 to 1.0
  reasoning jsonb, -- explainability: which patterns influenced verdict
  hold_release_at timestamp, -- when 24h hold expires
  user_proceeded boolean, -- did they buy despite red/yellow?
  actual_outcome text check (actual_outcome in ('satisfied', 'regret')), -- post-purchase swipe
  user_decision text check (user_decision in ('bought', 'hold', 'skip')), -- user's actual decision
  user_hold_until timestamp, -- when user's self-imposed hold expires
  created_at timestamp default now()
);

create table vendors (
  vendor_id int primary key,
  vendor_name text not null,
  vendor_category purchaseCategory not null,
  vendor_quality vendorQuality not null,
  vendor_reliability vendorReliability not null,
  vendor_price_tier vendorPriceTier not null
);

create table hold_timers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  verdict_id uuid references verdicts(id) on delete cascade,
  expires_at timestamp not null,
  notified boolean default false, -- push notification sent?
  created_at timestamp default now()
);

-- Public educational resources/articles.
-- Readable by all users when published.
create table resources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(slug) between 3 and 120),
  title text not null,
  summary text not null,
  body_markdown text not null,
  category text,
  tags text[] not null default '{}'::text[],
  reading_time_minutes int check (reading_time_minutes > 0),
  canonical_url text,
  cover_image_url text,
  cta_url text,
  is_published boolean not null default false,
  published_at timestamp,
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  check (published_at is null or is_published = true)
);

-- Add FK from purchases to verdicts (defined after verdicts table exists)
-- ON DELETE SET NULL: if verdict is deleted, purchase remains but loses the link
alter table purchases
  add constraint fk_purchases_verdict
  foreign key (verdict_id) references verdicts(id) on delete set null;

-- Optional vendor FK: only set when a vendor match is found
alter table purchases
  add constraint fk_purchases_vendor_id
  foreign key (vendor_id) references vendors(vendor_id) on delete set null;

alter table verdicts
  add constraint fk_verdicts_vendor_id
  foreign key (candidate_vendor_id) references vendors(vendor_id) on delete set null;

-- Index for finding purchase by verdict_id
create index idx_purchases_verdict on purchases(verdict_id) where verdict_id is not null;

-- Unique constraint: one purchase per verdict (prevents duplicates when marking verdict as 'bought')
create unique index idx_purchases_verdict_unique on purchases(verdict_id) where verdict_id is not null;

