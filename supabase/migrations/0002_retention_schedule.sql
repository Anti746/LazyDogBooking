-- ─────────────────────────────────────────────────────────────────────────────
-- Nightly deletion of personal data past the retention period (GDPR Art. 5(1)(e)).
--
-- Requires the pg_cron extension: Supabase → Database → Extensions → pg_cron
-- (or the `create extension` line below). The app also purges expired data
-- every time the admin calendar loads, so this is a second safety net.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pg_cron;

select cron.schedule(
  'lazydog-purge-expired-personal-data',
  '15 3 * * *',                                   -- every night at 03:15 UTC
  $$select public.purge_expired_personal_data()$$
);
