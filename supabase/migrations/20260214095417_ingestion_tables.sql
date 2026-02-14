-- Ingestion: email + OCR
-- Store encrypted OAuth credentials for email receipt ingestion.
-- Single connection per user. last_sync enables incremental imports rather than full scans.
create table email_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade unique,
  provider text not null, -- 'gmail', 'outlook', etc.
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
  vendor_name text unique not null,
  email_patterns text[], -- ['noreply@amazon.com', '%@marketplace.amazon.com']
  is_whitelisted boolean default true,
  default_category purchaseCategory,
  vendor_tier int check (vendor_tier between 0 and 3)
);

create table email_processed_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider email_connection_provider not null,
  email_id text not null,
  created_at timestamp default now(),
  last_processed_at timestamp default now(),
  unique(user_id, provider, email_id)
);

create table ocr_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  image_hash text unique, -- SHA-256 to prevent duplicate uploads
  status text check (status in ('pending', 'processing', 'completed', 'failed')),
  extracted_data jsonb, -- raw OCR output before user confirmation
  error_message text,
  created_at timestamp default now(),
  processed_at timestamp
);

