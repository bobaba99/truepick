-- Users and onboarding
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamp default now(),
  last_active timestamp,
  onboarding_completed boolean default false,
  profile_summary text,
  onboarding_answers jsonb, -- coreValues, regretPatterns, satisfactionPatterns, decisionStyle, neuroticismScore, materialism, locusOfControl, identityStability
  weekly_fun_budget decimal(10,2) check (weekly_fun_budget >= 0),
  preferences jsonb,
  constraint users_preferences_shape_check check (
    preferences is null
    or (
      jsonb_typeof(preferences) = 'object'
      and (
        not (preferences ? 'theme')
        or (preferences ->> 'theme') in ('light', 'dark')
      )
      and (
        not (preferences ? 'currency')
        or length(trim(preferences ->> 'currency')) > 0
      )
      and (
        not (preferences ? 'hold_duration_hours')
        or (preferences ->> 'hold_duration_hours') in ('24', '48', '72')
      )
      and (
        not (preferences ? 'hold_reminders_enabled')
        or jsonb_typeof(preferences -> 'hold_reminders_enabled') = 'boolean'
      )
    )
  )
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
  hold_release_at timestamp, -- when hold expires based on user preference
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

-- Vendor seed data moved from 20260214094223_vendor_data.sql
-- adding vendors into table vendors
insert into public.vendors (vendor_id, vendor_name, vendor_category, vendor_quality, vendor_reliability, vendor_price_tier) values
(1001, 'Princeton University', 'education', 'high', 'high', 'luxury'),
(1002, 'MIT', 'education', 'high', 'high', 'luxury'),
(1003, 'Harvard University', 'education', 'high', 'high', 'luxury'),
(1004, 'Stanford University', 'education', 'high', 'high', 'luxury'),
(1005, 'Yale University', 'education', 'high', 'high', 'luxury'),
(1006, 'Oxford University', 'education', 'high', 'high', 'premium'),
(1007, 'Cambridge University', 'education', 'high', 'high', 'premium'),
(1008, 'UC Berkeley', 'education', 'high', 'high', 'mid_range'),
(1009, 'Duolingo', 'education', 'high', 'high', 'budget'),
(1010, 'Coursera', 'education', 'high', 'high', 'mid_range'),
(1011, 'Udemy', 'education', 'medium', 'medium', 'budget'),
(1012, 'LinkedIn Learning', 'education', 'high', 'high', 'mid_range'),
(1013, 'Khan Academy', 'education', 'high', 'high', 'budget'),
(1014, 'Pluralsight', 'education', 'high', 'high', 'premium'),
(1015, 'Udacity', 'education', 'high', 'high', 'premium'),
(1016, 'Babbel', 'education', 'high', 'high', 'mid_range'),
(1017, 'Pearson', 'education', 'medium', 'high', 'mid_range'),
(1018, 'MasterClass', 'education', 'high', 'high', 'premium'),
(1019, 'Codecademy', 'education', 'high', 'high', 'mid_range'),
(1020, 'Skillshare', 'education', 'medium', 'medium', 'budget'),
(101, 'Apple', 'electronics', 'high', 'high', 'premium'),
(102, 'Samsung', 'electronics', 'high', 'high', 'mid_range'),
(103, 'NVIDIA', 'electronics', 'high', 'high', 'luxury'),
(104, 'Sony', 'electronics', 'high', 'high', 'premium'),
(105, 'Microsoft', 'electronics', 'high', 'high', 'premium'),
(106, 'LG', 'electronics', 'high', 'high', 'mid_range'),
(107, 'Dell Technologies', 'electronics', 'medium', 'medium', 'mid_range'),
(108, 'HP', 'electronics', 'medium', 'medium', 'mid_range'),
(109, 'Huawei', 'electronics', 'high', 'medium', 'premium'),
(110, 'Panasonic', 'electronics', 'medium', 'high', 'mid_range'),
(111, 'Lenovo', 'electronics', 'medium', 'medium', 'mid_range'),
(112, 'Garmin', 'electronics', 'high', 'high', 'premium'),
(113, 'Sony Interactive (PlayStation)', 'electronics', 'high', 'high', 'premium'),
(114, 'SharkNinja', 'electronics', 'high', 'high', 'mid_range'),
(115, 'Bosch', 'electronics', 'high', 'high', 'premium'),
(116, 'GoPro', 'electronics', 'high', 'medium', 'premium'),
(117, 'Nintendo', 'electronics', 'medium', 'high', 'mid_range'),
(118, 'Philips', 'electronics', 'medium', 'high', 'mid_range'),
(119, 'ASML', 'electronics', 'high', 'high', 'luxury'),
(120, 'Sonos', 'electronics', 'high', 'high', 'premium'),
(121, 'Whirlpool', 'electronics', 'high', 'high', 'mid_range'),
(122, 'Canon', 'electronics', 'high', 'high', 'premium'),
(123, 'Bose', 'electronics', 'high', 'high', 'premium'),
(124, 'Nikon', 'electronics', 'high', 'high', 'premium'),
(125, 'Kodak', 'electronics', 'medium', 'medium', 'budget'),
(126, 'TCL', 'electronics', 'medium', 'high', 'budget'),
(127, 'Hisense', 'electronics', 'medium', 'high', 'budget'),
(128, 'Roku', 'electronics', 'medium', 'high', 'budget'),
(129, 'ASUS', 'electronics', 'high', 'high', 'mid_range'),
(130, 'Brother', 'electronics', 'medium', 'high', 'mid_range'),
(131, 'Motorola', 'electronics', 'medium', 'high', 'budget'),
(132, 'Vizio', 'electronics', 'low', 'medium', 'budget'),
(133, 'GE Appliances', 'electronics', 'high', 'high', 'mid_range'),
(134, 'Electrolux', 'electronics', 'medium', 'high', 'mid_range'),
(135, 'KitchenAid', 'electronics', 'high', 'high', 'premium'),
(136, 'iRobot', 'electronics', 'high', 'high', 'mid_range'),
(137, 'Siemens', 'electronics', 'high', 'high', 'premium'),
(138, 'De''Longhi', 'electronics', 'high', 'high', 'premium'),
(139, 'Sennheiser', 'electronics', 'high', 'high', 'premium'),
(140, 'Logitech', 'electronics', 'high', 'high', 'mid_range'),
(141, 'Razer', 'electronics', 'high', 'high', 'premium'),
(142, 'AMD', 'electronics', 'high', 'high', 'mid_range'),
(143, 'Intel', 'electronics', 'high', 'high', 'mid_range'),
(144, 'TSMC', 'electronics', 'high', 'high', 'mid_range'),
(145, 'Foxconn', 'electronics', 'medium', 'high', 'mid_range'),
(146, 'Xiaomi', 'electronics', 'medium', 'medium', 'budget'),
(147, 'Oppo', 'electronics', 'medium', 'medium', 'budget'),
(148, 'Vivo', 'electronics', 'medium', 'medium', 'budget'),
(149, 'Midea', 'electronics', 'medium', 'high', 'budget'),
(150, 'Hamilton Beach', 'electronics', 'medium', 'high', 'budget'),
(601, 'Disney', 'entertainment', 'high', 'high', 'premium'),
(602, 'YouTube', 'entertainment', 'high', 'high', 'mid_range'),
(603, 'Netflix', 'entertainment', 'high', 'high', 'mid_range'),
(604, 'Instagram', 'entertainment', 'medium', 'high', 'mid_range'),
(605, 'TikTok', 'entertainment', 'medium', 'medium', 'mid_range'),
(606, 'Spotify', 'entertainment', 'high', 'high', 'mid_range'),
(607, 'NFL', 'entertainment', 'high', 'high', 'premium'),
(608, 'Nintendo', 'entertainment', 'high', 'high', 'mid_range'),
(609, 'Epic Games', 'entertainment', 'high', 'high', 'budget'),
(610, 'OpenAI', 'entertainment', 'high', 'medium', 'mid_range'),
(611, 'Universal Music Group', 'entertainment', 'high', 'high', 'premium'),
(612, 'Roblox', 'entertainment', 'medium', 'medium', 'budget'),
(613, 'Formula 1', 'entertainment', 'high', 'high', 'luxury'),
(614, 'Sony PlayStation', 'entertainment', 'high', 'high', 'premium'),
(615, 'Microsoft Xbox', 'entertainment', 'high', 'high', 'premium'),
(616, 'Discord', 'entertainment', 'medium', 'high', 'budget'),
(617, 'Twitch', 'entertainment', 'medium', 'high', 'budget'),
(618, 'Paramount+', 'entertainment', 'medium', 'medium', 'mid_range'),
(619, 'Red Bull', 'entertainment', 'high', 'high', 'mid_range'),
(620, 'Ticketmaster', 'entertainment', 'low', 'medium', 'premium'),
(201, 'Nike', 'fashion', 'high', 'high', 'mid_range'),
(202, 'Louis Vuitton', 'fashion', 'high', 'high', 'luxury'),
(203, 'Zara', 'fashion', 'medium', 'medium', 'mid_range'),
(204, 'Hermes', 'fashion', 'high', 'high', 'luxury'),
(205, 'Uniqlo', 'fashion', 'high', 'high', 'mid_range'),
(206, 'Adidas', 'fashion', 'high', 'high', 'mid_range'),
(207, 'Chanel', 'fashion', 'high', 'high', 'luxury'),
(208, 'H&M', 'fashion', 'medium', 'medium', 'budget'),
(209, 'Gucci', 'fashion', 'high', 'medium', 'luxury'),
(210, 'Lululemon', 'fashion', 'high', 'high', 'premium'),
(211, 'The North Face', 'fashion', 'high', 'high', 'premium'),
(212, 'Patagonia', 'fashion', 'high', 'high', 'premium'),
(213, 'Carhartt', 'fashion', 'high', 'high', 'mid_range'),
(214, 'Levi''s', 'fashion', 'medium', 'high', 'mid_range'),
(215, 'Tommy Hilfiger', 'fashion', 'high', 'medium', 'premium'),
(216, 'Deckers (Hoka)', 'fashion', 'high', 'high', 'premium'),
(217, 'Old Navy', 'fashion', 'low', 'medium', 'budget'),
(218, 'Columbia', 'fashion', 'medium', 'high', 'mid_range'),
(219, 'Rolex', 'fashion', 'high', 'high', 'luxury'),
(220, 'Dior', 'fashion', 'high', 'medium', 'luxury'),
(221, 'Prada', 'fashion', 'high', 'high', 'luxury'),
(222, 'Fendi', 'fashion', 'high', 'medium', 'luxury'),
(223, 'Burberry', 'fashion', 'high', 'high', 'luxury'),
(224, 'Saint Laurent', 'fashion', 'high', 'high', 'luxury'),
(225, 'Versace', 'fashion', 'high', 'high', 'luxury'),
(226, 'Balenciaga', 'fashion', 'high', 'medium', 'luxury'),
(227, 'Cartier', 'fashion', 'high', 'high', 'luxury'),
(228, 'Tiffany & Co', 'fashion', 'high', 'high', 'luxury'),
(229, 'Michael Kors', 'fashion', 'medium', 'high', 'mid_range'),
(230, 'Coach', 'fashion', 'medium', 'high', 'mid_range'),
(231, 'Tory Burch', 'fashion', 'medium', 'high', 'premium'),
(232, 'Ralph Lauren', 'fashion', 'high', 'high', 'premium'),
(233, 'Calvin Klein', 'fashion', 'medium', 'high', 'mid_range'),
(234, 'Hugo Boss', 'fashion', 'medium', 'high', 'premium'),
(235, 'Guess', 'fashion', 'low', 'medium', 'budget'),
(236, 'Alo Yoga', 'fashion', 'high', 'high', 'premium'),
(237, 'Free People', 'fashion', 'medium', 'high', 'mid_range'),
(238, 'Madewell', 'fashion', 'high', 'high', 'mid_range'),
(239, 'Everlane', 'fashion', 'high', 'high', 'mid_range'),
(240, 'Buck Mason', 'fashion', 'high', 'high', 'premium'),
(241, 'Reformation', 'fashion', 'high', 'high', 'premium'),
(242, 'Canada Goose', 'fashion', 'high', 'high', 'luxury'),
(243, 'T.J. Maxx', 'fashion', 'medium', 'high', 'budget'),
(244, 'Ross', 'fashion', 'low', 'medium', 'budget'),
(245, 'Nordstrom Rack', 'fashion', 'medium', 'high', 'budget'),
(246, 'SHEIN', 'fashion', 'low', 'low', 'budget'),
(247, 'The Row', 'fashion', 'high', 'high', 'luxury'),
(248, 'Toteme', 'fashion', 'high', 'high', 'premium'),
(249, 'Khaite', 'fashion', 'high', 'high', 'luxury'),
(250, 'Kallmeyer', 'fashion', 'high', 'high', 'premium'),
(801, 'Coca-Cola', 'food & beverage', 'high', 'high', 'budget'),
(802, 'Starbucks', 'food & beverage', 'high', 'high', 'premium'),
(803, 'McDonald''s', 'food & beverage', 'medium', 'high', 'budget'),
(804, 'PepsiCo', 'food & beverage', 'high', 'high', 'budget'),
(805, 'Chick-fil-A', 'food & beverage', 'high', 'high', 'mid_range'),
(806, 'Chipotle', 'food & beverage', 'high', 'medium', 'mid_range'),
(807, 'Nestlé', 'food & beverage', 'medium', 'high', 'mid_range'),
(808, 'Red Bull', 'food & beverage', 'high', 'high', 'premium'),
(809, 'Heinz', 'food & beverage', 'high', 'high', 'budget'),
(810, 'Fairlife', 'food & beverage', 'high', 'high', 'mid_range'),
(811, 'Hershey''s', 'food & beverage', 'high', 'high', 'budget'),
(812, 'Barilla', 'food & beverage', 'high', 'high', 'mid_range'),
(813, 'Oikos', 'food & beverage', 'high', 'high', 'mid_range'),
(814, 'Ferrero', 'food & beverage', 'high', 'high', 'premium'),
(815, 'Danone', 'food & beverage', 'medium', 'high', 'mid_range'),
(816, 'Heineken', 'food & beverage', 'medium', 'high', 'mid_range'),
(817, 'AB InBev', 'food & beverage', 'medium', 'high', 'mid_range'),
(818, 'Jollibee', 'food & beverage', 'medium', 'high', 'budget'),
(819, 'Tyson Foods', 'food & beverage', 'medium', 'high', 'mid_range'),
(820, 'Mondelez', 'food & beverage', 'medium', 'high', 'budget'),
(401, 'Peloton', 'health & wellness', 'high', 'high', 'premium'),
(402, 'Lululemon', 'health & wellness', 'high', 'high', 'premium'),
(403, 'Calm', 'health & wellness', 'high', 'high', 'mid_range'),
(404, 'WHOOP', 'health & wellness', 'high', 'high', 'premium'),
(405, 'Headspace Health', 'health & wellness', 'high', 'high', 'mid_range'),
(406, 'Oura', 'health & wellness', 'high', 'high', 'premium'),
(407, 'Lyra Health', 'health & wellness', 'high', 'high', 'premium'),
(408, 'Hims & Hers', 'health & wellness', 'medium', 'high', 'mid_range'),
(409, 'Nestlé Health Science', 'health & wellness', 'high', 'high', 'mid_range'),
(410, 'Planet Fitness', 'health & wellness', 'low', 'high', 'budget'),
(411, 'Life Time', 'health & wellness', 'high', 'high', 'premium'),
(412, 'Garmin', 'health & wellness', 'high', 'high', 'premium'),
(413, 'BetterHelp', 'health & wellness', 'medium', 'high', 'mid_range'),
(414, 'Noom', 'health & wellness', 'medium', 'medium', 'mid_range'),
(415, 'Athletic Greens', 'health & wellness', 'high', 'high', 'premium'),
(416, 'Equinox', 'health & wellness', 'high', 'high', 'luxury'),
(417, 'Fitbit', 'health & wellness', 'medium', 'high', 'mid_range'),
(418, 'Tonal', 'health & wellness', 'high', 'high', 'luxury'),
(419, 'Dutch Bros', 'health & wellness', 'medium', 'high', 'budget'),
(420, 'Holland & Barrett', 'health & wellness', 'high', 'high', 'mid_range'),
(301, 'IKEA', 'home goods', 'medium', 'high', 'budget'),
(302, 'Ashley Furniture', 'home goods', 'medium', 'medium', 'mid_range'),
(303, 'Williams-Sonoma', 'home goods', 'high', 'high', 'premium'),
(304, 'Restoration Hardware (RH)', 'home goods', 'high', 'high', 'luxury'),
(305, 'Wayfair', 'home goods', 'medium', 'medium', 'budget'),
(306, 'Pottery Barn', 'home goods', 'high', 'high', 'premium'),
(307, 'West Elm', 'home goods', 'medium', 'high', 'mid_range'),
(308, 'Steelcase', 'home goods', 'high', 'high', 'premium'),
(309, 'Herman Miller', 'home goods', 'high', 'high', 'luxury'),
(310, 'La-Z-Boy', 'home goods', 'medium', 'high', 'mid_range'),
(311, 'Speed Queen', 'home goods', 'high', 'high', 'premium'),
(312, 'Miele', 'home goods', 'high', 'high', 'premium'),
(313, 'Haier', 'home goods', 'medium', 'medium', 'mid_range'),
(314, 'Whirlpool', 'home goods', 'medium', 'high', 'mid_range'),
(315, 'Ethan Allen', 'home goods', 'high', 'high', 'premium'),
(316, 'Crate & Barrel', 'home goods', 'high', 'high', 'premium'),
(317, 'Nitori', 'home goods', 'medium', 'high', 'budget'),
(318, 'Tempur Sealy', 'home goods', 'high', 'high', 'premium'),
(319, 'Bosch Home', 'home goods', 'high', 'high', 'premium'),
(320, 'Home Depot', 'home goods', 'medium', 'high', 'mid_range'),
(901, 'Amazon', 'services', 'high', 'high', 'budget'),
(902, 'Visa', 'services', 'high', 'high', 'mid_range'),
(903, 'Mastercard', 'services', 'high', 'high', 'mid_range'),
(904, 'JPMorgan Chase', 'services', 'high', 'high', 'mid_range'),
(905, 'Stripe', 'services', 'high', 'high', 'mid_range'),
(906, 'Shopify', 'services', 'high', 'high', 'mid_range'),
(907, 'UPS', 'services', 'high', 'high', 'mid_range'),
(908, 'FedEx', 'services', 'medium', 'high', 'mid_range'),
(909, 'Salesforce', 'services', 'high', 'high', 'premium'),
(910, 'Accenture', 'services', 'high', 'high', 'premium'),
(911, 'American Express', 'services', 'high', 'high', 'premium'),
(912, 'Goldman Sachs', 'services', 'high', 'high', 'luxury'),
(913, 'SAP', 'services', 'high', 'high', 'luxury'),
(914, 'Oracle', 'services', 'high', 'high', 'premium'),
(915, 'IBM', 'services', 'medium', 'high', 'premium'),
(916, 'Bank of America', 'services', 'medium', 'high', 'mid_range'),
(917, 'PayPal', 'services', 'medium', 'high', 'mid_range'),
(918, 'Maersk', 'services', 'medium', 'high', 'premium'),
(919, 'Deloitte', 'services', 'high', 'high', 'premium'),
(920, 'PwC', 'services', 'high', 'high', 'premium'),
(701, 'Netflix', 'subscriptions', 'high', 'high', 'mid_range'),
(702, 'Amazon Prime', 'subscriptions', 'high', 'high', 'budget'),
(703, 'Disney+', 'subscriptions', 'high', 'high', 'mid_range'),
(704, 'Spotify', 'subscriptions', 'high', 'high', 'mid_range'),
(705, 'YouTube Premium', 'subscriptions', 'high', 'high', 'mid_range'),
(706, 'Microsoft 365', 'subscriptions', 'high', 'high', 'mid_range'),
(707, 'HBO Max', 'subscriptions', 'high', 'high', 'premium'),
(708, 'Hulu', 'subscriptions', 'medium', 'high', 'mid_range'),
(709, 'Apple TV+', 'subscriptions', 'high', 'high', 'premium'),
(710, 'Crunchyroll', 'subscriptions', 'high', 'high', 'budget'),
(711, 'HelloFresh', 'subscriptions', 'high', 'high', 'mid_range'),
(712, 'Adobe Creative Cloud', 'subscriptions', 'high', 'high', 'premium'),
(713, 'BarkBox', 'subscriptions', 'medium', 'high', 'mid_range'),
(714, 'Harry''s', 'subscriptions', 'high', 'high', 'budget'),
(715, 'Peloton App', 'subscriptions', 'high', 'high', 'mid_range'),
(716, 'Blue Apron', 'subscriptions', 'medium', 'high', 'mid_range'),
(717, 'MasterClass', 'subscriptions', 'high', 'high', 'premium'),
(718, 'Coursera Plus', 'subscriptions', 'high', 'high', 'mid_range'),
(719, 'ESPN+', 'subscriptions', 'medium', 'high', 'mid_range'),
(720, 'Paramount+', 'subscriptions', 'medium', 'medium', 'mid_range'),
(501, 'Royal Caribbean', 'travel', 'high', 'high', 'premium'),
(502, 'Delta Air Lines', 'travel', 'high', 'high', 'mid_range'),
(503, 'Booking.com', 'travel', 'medium', 'high', 'mid_range'),
(504, 'Airbnb', 'travel', 'medium', 'medium', 'mid_range'),
(505, 'Marriott International', 'travel', 'high', 'high', 'premium'),
(506, 'Hilton Worldwide', 'travel', 'high', 'high', 'mid_range'),
(507, 'Southwest Airlines', 'travel', 'medium', 'high', 'budget'),
(508, 'Four Seasons', 'travel', 'high', 'high', 'luxury'),
(509, 'Six Senses', 'travel', 'high', 'high', 'luxury'),
(510, 'Disney Cruise Line', 'travel', 'high', 'high', 'premium'),
(511, 'Hyatt Hotels', 'travel', 'high', 'high', 'premium'),
(512, 'United Airlines', 'travel', 'medium', 'medium', 'mid_range'),
(513, 'Ritz-Carlton', 'travel', 'high', 'high', 'luxury'),
(514, 'Expedia', 'travel', 'medium', 'high', 'mid_range'),
(515, 'Uber', 'travel', 'medium', 'high', 'mid_range'),
(516, 'Alaska Air Group', 'travel', 'high', 'high', 'mid_range'),
(517, 'Rosewood Hotels', 'travel', 'high', 'high', 'luxury'),
(518, 'Chiva-Som', 'travel', 'high', 'high', 'luxury'),
(519, 'Carnival Corp', 'travel', 'medium', 'high', 'mid_range'),
(520, 'Aman Resorts', 'travel', 'high', 'high', 'luxury');
