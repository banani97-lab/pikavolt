-- Server-side expiry of unpaid appointment holds.
--
-- A booking inserts a 'requested' appointment immediately (holding the slot via
-- the exclusion constraint) and only becomes real once its deposit
-- PaymentIntent succeeds. If the customer abandons checkout, the slot would
-- stay held forever. This frees it after 30 minutes.
--
-- Runs in Postgres via pg_cron (scheduled on the cloud DB — see the project's
-- deploy notes) rather than a Vercel Cron, so it's free of Vercel plan limits
-- and independent of the web app being up. requested -> cancelled is a legal
-- state-machine transition, so the enforce/log triggers fire normally.
--
-- Note: this frees the slot but does not cancel the abandoned Stripe
-- PaymentIntent (pg_cron can't call Stripe). Stripe expires uncaptured
-- PaymentIntents on its own; the manual /api/cron/expire-unpaid endpoint still
-- exists for a Stripe-aware sweep if ever wanted.

create or replace function public.expire_unpaid_appointments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  with expired as (
    update public.appointments a
    set status = 'cancelled',
        cancelled_reason = 'Deposit not completed within 30 minutes'
    where a.status = 'requested'
      and a.created_at < now() - interval '30 minutes'
      and not exists (
        select 1 from public.payments p
        where p.appointment_id = a.id
          and p.kind = 'deposit'
          and p.status = 'succeeded'
      )
    returning 1
  )
  select count(*) into affected from expired;
  return affected;
end;
$$;

revoke all on function public.expire_unpaid_appointments() from anon, authenticated;
