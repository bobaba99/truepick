do $$
declare
  test_user_id uuid;
  test_verdict_id uuid;
begin
  insert into public.users (
    id,
    email,
    created_at,
    last_active,
    onboarding_completed,
    weekly_fun_budget,
    preferences
  )
  values (
    gen_random_uuid(),
    'gavingengzihao@gmail.com',
    now(),
    now(),
    true,
    200.00,
    jsonb_build_object(
      'theme', 'light',
      'currency', 'USD',
      'hold_duration_hours', 24,
      'hold_reminders_enabled', true
    )
  )
  on conflict (email) do update
    set last_active = now(),
        preferences = coalesce(public.users.preferences, '{}'::jsonb) || jsonb_build_object(
          'hold_duration_hours', 24,
          'hold_reminders_enabled', true,
          'currency', 'USD',
          'theme', 'light'
        )
  returning id into test_user_id;

  if test_user_id is null then
    select id into test_user_id
    from public.users
    where email = 'gavingengzihao@gmail.com'
    limit 1;
  end if;

  insert into public.verdicts (
    user_id,
    candidate_title,
    candidate_price,
    candidate_category,
    candidate_vendor,
    scoring_model,
    justification,
    predicted_outcome,
    confidence_score,
    reasoning,
    hold_release_at,
    created_at
  )
  values (
    test_user_id,
    '1-Minute Hold Reminder Test',
    49.99,
    'electronics',
    'Sony',
    'llm_only',
    'Testing a 1-minute hold reminder email',
    'hold',
    0.75,
    jsonb_build_object(
      'rationale', '<p>Test verdict for a 1-minute hold reminder.</p>',
      'rationaleOneLiner', '1-minute hold reminder test.',
      'alternativeSolution', '<p>Wait one minute, then check whether the reminder sends.</p>',
      'decisionScore', 0.75,
      'importantPurchase', false,
      'algorithm', 'llm_only'
    ),
    now() + interval '1 minute',
    now()
  )
  returning id into test_verdict_id;

  insert into public.hold_timers (
    user_id,
    verdict_id,
    expires_at,
    notified,
    created_at
  )
  values (
    test_user_id,
    test_verdict_id,
    now() + interval '1 minute',
    false,
    now()
  );

  raise notice 'Created 1-minute hold test. User %, verdict %.', test_user_id, test_verdict_id;
end $$;
