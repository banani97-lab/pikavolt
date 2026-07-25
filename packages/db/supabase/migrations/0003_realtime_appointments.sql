-- Publish appointments + tracking_sessions for realtime.
--
-- Both the mobile app and the web app subscribe to live appointment rows
-- (owner job screen action buttons, owner today list, customer live status
-- chip / next-appointment card, tracking snapshot). Those subscriptions were
-- silently inert because 0001 only added `messages` and `conversations` to the
-- `supabase_realtime` publication: the initial fetch succeeded, so screens
-- looked correct on load but never updated. Caught by driving the owner
-- "ARRIVED" flow on a simulator — the DB transitioned but the UI stayed put.
--
-- RLS still governs delivery: realtime evaluates the same SELECT policies, so
-- customers only receive their own appointments and the owner receives all.

alter publication supabase_realtime add table public.appointments;
alter publication supabase_realtime add table public.tracking_sessions;

-- REPLICA IDENTITY FULL so realtime emits the complete row. Required for
-- server-side filtering on non-primary-key columns (e.g. the customer's
-- appointment list filters by customer_id) and for RLS to evaluate policies
-- against every column. Both tables are low write-volume, so the extra WAL
-- payload is negligible.
alter table public.appointments replica identity full;
alter table public.tracking_sessions replica identity full;
