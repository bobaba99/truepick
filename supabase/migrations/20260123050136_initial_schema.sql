-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Enums
create type purchase_source as enum ('email', 'ocr', 'manual');
create type swipe_outcome as enum ('satisfied', 'regret');
create type user_value_type as enum ('convenience', 'durability', 'experience', 'impulse_sensitivity');
create type ocr_status as enum ('pending', 'processing', 'completed', 'failed');
create type verdict_outcome as enum ('yes', 'hold', 'no');

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
  value_type user_value_type not null, -- 'convenience', 'durability', 'experience', 'impulse_sensitivity'
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
  source varchar(20) check (source in ('email', 'ocr', 'manual')),
  order_id varchar(255), -- for deduplication
  created_at timestamp default now(),
  unique(user_id, vendor, order_id) -- prevent duplicate imports
);

create table swipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  purchase_id uuid references purchases(id) on delete cascade,
  outcome varchar(20) check (outcome in ('satisfied', 'regret')) not null,
  created_at timestamp default now(),
  unique(user_id, purchase_id) -- one verdict per purchase
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
  predicted_outcome varchar(20) check (predicted_outcome in ('buy', 'hold', 'no')),
  confidence_score decimal(5,4), -- 0.0 to 1.0
  reasoning jsonb, -- explainability: which patterns influenced verdict
  hold_release_at timestamp, -- when 24h hold expires
  user_proceeded boolean, -- did they buy despite red/yellow?
  actual_outcome varchar(20) check (actual_outcome in ('satisfied', 'regret')), -- post-purchase swipe
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
create index idx_swipes_user_created on swipes(user_id, created_at desc);
create index idx_verdicts_user_created on verdicts(user_id, created_at desc);
create index idx_hold_timers_expires on hold_timers(expires_at) where notified = false;

-- Pattern aggregation
create index idx_purchases_category on purchases(user_id, category);
create index idx_purchases_vendor_tier on purchases(user_id, vendor_tier);

-- Email sync
create index idx_email_connections_active on email_connections(user_id) where is_active = true;
