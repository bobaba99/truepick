-- Row Level Security (RLS)
alter table users enable row level security;

-- Allow users to read their own profile row
create policy "users_select_own"
  on users
  for select
  using ((select auth.uid()) = id);

-- Allow users to insert their own profile row
create policy "users_insert_own"
  on users
  for insert
  with check ((select auth.uid()) = id);

-- Allow users to update their own profile row
create policy "users_update_own"
  on users
  for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Purchases RLS
alter table purchases enable row level security;

create policy "purchases_select_own"
  on purchases
  for select
  using ((select auth.uid()) = user_id);

create policy "purchases_insert_own"
  on purchases
  for insert
  with check ((select auth.uid()) = user_id);

create policy "purchases_update_own"
  on purchases
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "purchases_delete_own"
  on purchases
  for delete
  using ((select auth.uid()) = user_id);

-- User values RLS
alter table user_values enable row level security;

create policy "user_values_select_own"
  on user_values
  for select
  using ((select auth.uid()) = user_id);

create policy "user_values_insert_own"
  on user_values
  for insert
  with check ((select auth.uid()) = user_id);

create policy "user_values_update_own"
  on user_values
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "user_values_delete_own"
  on user_values
  for delete
  using ((select auth.uid()) = user_id);

-- Swipe schedules RLS
alter table swipe_schedules enable row level security;

create policy "swipe_schedules_select_own"
  on swipe_schedules
  for select
  using ((select auth.uid()) = user_id);

create policy "swipe_schedules_insert_own"
  on swipe_schedules
  for insert
  with check ((select auth.uid()) = user_id);

create policy "swipe_schedules_update_own"
  on swipe_schedules
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "swipe_schedules_delete_own"
  on swipe_schedules
  for delete
  using ((select auth.uid()) = user_id);

-- Swipes RLS
alter table swipes enable row level security;

create policy "swipes_select_own"
  on swipes
  for select
  using ((select auth.uid()) = user_id);

create policy "swipes_insert_own"
  on swipes
  for insert
  with check ((select auth.uid()) = user_id);

create policy "swipes_update_own"
  on swipes
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "swipes_delete_own"
  on swipes
  for delete
  using ((select auth.uid()) = user_id);

-- Purchase stats RLS
alter table purchase_stats enable row level security;

create policy "purchase_stats_select_own"
  on purchase_stats
  for select
  using ((select auth.uid()) = user_id);

create policy "purchase_stats_insert_own"
  on purchase_stats
  for insert
  with check ((select auth.uid()) = user_id);

create policy "purchase_stats_update_own"
  on purchase_stats
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "purchase_stats_delete_own"
  on purchase_stats
  for delete
  using ((select auth.uid()) = user_id);

-- Resources RLS
alter table resources enable row level security;

create policy "resources_select_published"
  on resources
  for select
  using (is_published = true);

-- Verdicts RLS
alter table verdicts enable row level security;

create policy "verdicts_select_own"
  on verdicts
  for select
  using ((select auth.uid()) = user_id);

create policy "verdicts_insert_own"
  on verdicts
  for insert
  with check ((select auth.uid()) = user_id);

create policy "verdicts_update_own"
  on verdicts
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "verdicts_delete_own"
  on verdicts
  for delete
  using ((select auth.uid()) = user_id);

-- Hold timers RLS
alter table hold_timers enable row level security;

create policy "hold_timers_select_own"
  on hold_timers
  for select
  using ((select auth.uid()) = user_id);

create policy "hold_timers_insert_own"
  on hold_timers
  for insert
  with check ((select auth.uid()) = user_id);

create policy "hold_timers_update_own"
  on hold_timers
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "hold_timers_delete_own"
  on hold_timers
  for delete
  using ((select auth.uid()) = user_id);

-- Email connections RLS
alter table email_connections enable row level security;

create policy "email_connections_select_own"
  on email_connections
  for select
  using ((select auth.uid()) = user_id);

create policy "email_connections_insert_own"
  on email_connections
  for insert
  with check ((select auth.uid()) = user_id);

create policy "email_connections_update_own"
  on email_connections
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "email_connections_delete_own"
  on email_connections
  for delete
  using ((select auth.uid()) = user_id);

-- Email processed messages RLS
alter table email_processed_messages enable row level security;

create policy "email_processed_messages_select_own"
  on email_processed_messages
  for select
  using ((select auth.uid()) = user_id);

create policy "email_processed_messages_insert_own"
  on email_processed_messages
  for insert
  with check ((select auth.uid()) = user_id);

create policy "email_processed_messages_update_own"
  on email_processed_messages
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "email_processed_messages_delete_own"
  on email_processed_messages
  for delete
  using ((select auth.uid()) = user_id);

-- OCR jobs RLS
alter table ocr_jobs enable row level security;

create policy "ocr_jobs_select_own"
  on ocr_jobs
  for select
  using ((select auth.uid()) = user_id);

create policy "ocr_jobs_insert_own"
  on ocr_jobs
  for insert
  with check ((select auth.uid()) = user_id);

create policy "ocr_jobs_update_own"
  on ocr_jobs
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "ocr_jobs_delete_own"
  on ocr_jobs
  for delete
  using ((select auth.uid()) = user_id);

