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
create index idx_email_processed_messages_lookup on email_processed_messages(user_id, provider, email_id);

-- Resources
create index idx_resources_published on resources(is_published, published_at desc);
create index idx_resources_category on resources(category);
create index idx_resources_tags_gin on resources using gin(tags);

