-- Seed data for local development and testing
-- Run with: supabase db reset (which applies migrations then seed.sql)

-- Test user ID (use a fixed UUID so it can be referenced)

-- Temporarily disable RLS for seeding
alter table users disable row level security;
alter table purchases disable row level security;
alter table user_values disable row level security;
alter table swipe_schedules disable row level security;
alter table swipes disable row level security;

-- Fixed test user UUID (create a user in Supabase Auth with this ID, or use for direct DB testing)
do $$
declare
  test_user_id uuid;
  target_email text := 'gavingengzihao@gmail.com';
begin
  -- Match by email: prefer auth.users, then public.users, otherwise create a new id
  select id into test_user_id from auth.users where email = target_email;
  if test_user_id is null then
    select id into test_user_id from public.users where email = target_email;
  end if;
  if test_user_id is null then
    test_user_id := gen_random_uuid();
    insert into public.users (
      id,
      email,
      onboarding_completed,
      profile_summary,
      weekly_fun_budget,
      onboarding_answers
    )
    values (
      test_user_id,
      target_email,
      true,
      'Focused on financial stability and durability, cautious about impulse buys.',
      120.00,
      jsonb_build_object(
        'coreValues', jsonb_build_array('Financial stability', 'Minimalism / low clutter', 'Emotional wellbeing', 'Self-improvement', 'Convenience'),
        'regretPatterns', jsonb_build_array('It duplicated something I already had', ),
        'satisfactionPatterns', jsonb_build_array('Lasts a long time', 'Improves my daily routine', 'Makes life calmer or easier', 'Saves time or energy', 'Supports my growth or habits'),
        'decisionStyle', 'I plan carefully and delay',
        'financialSensitivity', 'Balanced',
      'spendingStressScore', 3,
      'emotionalRelationship', jsonb_build_object(
        'stability', 4,
        'excitement', 4,
        'control', 4,
        'reward', 5
      ),
        'identityStability', 'Somewhat important'
      )
    );
  else
    insert into public.users (
      id,
      email,
      onboarding_completed,
      profile_summary,
      weekly_fun_budget,
      onboarding_answers
    )
    values (
      test_user_id,
      target_email,
      true,
      'Focused on financial stability and durability, cautious about impulse buys.',
      120.00,
      jsonb_build_object(
        'coreValues', jsonb_build_array('Financial stability', 'Minimalism / low clutter'),
        'regretPatterns', jsonb_build_array('I bought impulsively'),
        'satisfactionPatterns', jsonb_build_array('Lasts a long time'),
        'decisionStyle', 'I plan carefully and delay',
        'financialSensitivity', 'Very cautious',
        'spendingStressScore', 0.7,
        'emotionalRelationship', jsonb_build_object(
          'stability', 2,
          'excitement', 4,
          'control', 4,
          'reward', 5
        ),
        'identityStability', 'Somewhat important'
      )
    )
    on conflict (id) do update set
      onboarding_completed = true,
      profile_summary = excluded.profile_summary,
      weekly_fun_budget = excluded.weekly_fun_budget,
      onboarding_answers = excluded.onboarding_answers;
  end if;

  -- Insert 20 past purchases with variety
  -- vendor_tier: 0: luxury, 1: premium, 2: mid-tier, 3: generic
  insert into purchases (user_id, title, price, vendor, vendor_tier, category, purchase_date, source, order_id) values
    -- Electronics (mixed satisfaction patterns)
    (test_user_id, 'Wireless Noise-Cancelling Headphones', 299.99, 'Amazon', 2, 'electronics', current_date - interval '45 days', 'manual', 'ORD-001'),
    (test_user_id, 'USB-C Hub 7-in-1', 49.99, 'Amazon', 2, 'electronics', current_date - interval '42 days', 'manual', 'ORD-002'),
    (test_user_id, 'Mechanical Keyboard RGB', 129.00, 'Best Buy', 2, 'electronics', current_date - interval '38 days', 'manual', 'ORD-003'),
    (test_user_id, 'Smart Watch Fitness Tracker', 199.00, 'Amazon', 2, 'electronics', current_date - interval '35 days', 'manual', 'ORD-004'),

    -- Clothing (impulse-heavy category)
    (test_user_id, 'Designer Hoodie Limited Edition', 189.00, 'Nordstrom', 1, 'fashion', current_date - interval '32 days', 'manual', 'ORD-005'),
    (test_user_id, 'Running Shoes Trail Pro', 145.00, 'Nike', 1, 'fashion', current_date - interval '30 days', 'manual', 'ORD-006'),
    (test_user_id, 'Vintage Band T-Shirt', 35.00, 'Urban Outfitters', 2, 'fashion', current_date - interval '28 days', 'manual', 'ORD-007'),
    (test_user_id, 'Winter Jacket Waterproof', 220.00, 'REI', 1, 'fashion', current_date - interval '25 days', 'manual', 'ORD-008'),

    -- Home & Kitchen
    (test_user_id, 'Air Fryer 5.8 Qt', 89.99, 'Amazon', 2, 'home goods', current_date - interval '22 days', 'manual', 'ORD-009'),
    (test_user_id, 'Instant Pot Duo 7-in-1', 79.95, 'Target', 2, 'home goods', current_date - interval '20 days', 'manual', 'ORD-010'),
    (test_user_id, 'Decorative Throw Pillows Set', 65.00, 'West Elm', 1, 'home goods', current_date - interval '18 days', 'manual', 'ORD-011'),
    (test_user_id, 'Robot Vacuum Cleaner', 349.00, 'Amazon', 2, 'home goods', current_date - interval '15 days', 'manual', 'ORD-012'),

    -- Entertainment & Hobbies
    (test_user_id, 'Board Game Collection Bundle', 75.00, 'Target', 2, 'experiences', current_date - interval '14 days', 'manual', 'ORD-013'),
    (test_user_id, 'Streaming Service Annual Sub', 139.99, 'Netflix', 2, 'subscriptions', current_date - interval '12 days', 'manual', 'ORD-014'),
    (test_user_id, 'Vinyl Record Player Retro', 129.00, 'Urban Outfitters', 2, 'electronics', current_date - interval '10 days', 'manual', 'ORD-015'),

    -- Food & Dining (often regretted impulse)
    (test_user_id, 'Gourmet Coffee Subscription 3mo', 89.00, 'Blue Bottle', 1, 'subscriptions', current_date - interval '8 days', 'manual', 'ORD-016'),
    (test_user_id, 'Fancy Dinner Date Night', 185.00, 'Eleven Madison Park', 0, 'food & beverage', current_date - interval '6 days', 'manual', 'ORD-017'),

    -- Fitness & Health
    (test_user_id, 'Yoga Mat Premium Cork', 68.00, 'Lululemon', 1, 'health & wellness', current_date - interval '5 days', 'manual', 'ORD-018'),
    (test_user_id, 'Protein Powder 5lb Tub', 54.99, 'Amazon', 2, 'health & wellness', current_date - interval '3 days', 'manual', 'ORD-019'),

    -- Miscellaneous
    (test_user_id, 'Online Course: Web Development', 199.00, 'Udemy', 2, 'education', current_date - interval '1 day', 'manual', 'ORD-020')
  on conflict do nothing;

  -- Generate swipe schedules for all seeded purchases to populate the feedback loop
  insert into swipe_schedules (user_id, purchase_id, timing, scheduled_for)
  select 
    user_id, 
    id, 
    t.timing,
    case 
      when t.timing = 'immediate' then purchase_date
      when t.timing = 'week3' then purchase_date + interval '3 weeks'
      when t.timing = 'month3' then purchase_date + interval '3 months'
    end as scheduled_for
  from purchases
  cross join (
    select unnest(array['immediate','week3','month3']::swipe_timing[]) as timing
  ) t
  where user_id = test_user_id
  on conflict do nothing;

  -- Add some user values for the test user
  insert into user_values (user_id, value_type, preference_score)
  values
    (test_user_id, 'interpersonal_value', 3),
    (test_user_id, 'durability', 5),
    (test_user_id, 'efficiency', 5),
    (test_user_id, 'emotional_value', 3),
    (test_user_id, 'aesthetics', 4)
  on conflict (user_id, value_type) do update set preference_score = excluded.preference_score;
end $$;

-- Re-enable RLS
alter table users enable row level security;
alter table purchases enable row level security;
alter table user_values enable row level security;
alter table swipe_schedules enable row level security;
alter table swipes enable row level security;
