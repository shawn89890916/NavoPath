-- Prompt PostgREST to rebuild its schema cache after the calendar-feed DDL.
-- Reading the notification queue is Supabase's non-disruptive recovery step
-- when schema-change notifications have become stale.
select pg_notification_queue_usage();
notify pgrst, 'reload schema';
