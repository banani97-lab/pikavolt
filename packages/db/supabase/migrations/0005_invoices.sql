-- Ad-hoc custom invoices.
--
-- An invoice is an owner-created appointment (is_invoice = true) for a custom
-- job total, billed as an upfront amount now + the remainder on completion. It
-- reuses the existing deposit/final payment machinery: the upfront is recorded
-- as a 'deposit' payment and the remainder is the ordinary 'final' payment
-- (computeFinal already yields job_total - deposit).
--
-- Off the booking calendar: invoices are created with scheduled_start =
-- scheduled_end, i.e. an EMPTY tstzrange. `empty && anything` is false, so the
-- appointments_no_overlap exclusion constraint never applies to invoices and a
-- multi-day job can't block normal booking slots.
--
-- Paid via a public, unguessable token link (no login) so commercial clients
-- can pay without an app account.

alter table public.appointments
  add column if not exists is_invoice boolean not null default false,
  add column if not exists invoice_token text unique;

-- Invoices have no scheduled service address, so address_id must be nullable.
-- Normal bookings still always set it (the deposit route validates ownership),
-- so this only relaxes the constraint for the invoice path.
alter table public.appointments
  alter column address_id drop not null;

comment on column public.appointments.is_invoice is
  'True for owner-created ad-hoc invoices (custom total, off the booking calendar).';
comment on column public.appointments.invoice_token is
  'Unguessable token for the public invoice pay link (/invoice/<token>); no login required.';

-- Look up an invoice by its public token (service-role reads only; RLS on
-- appointments is unchanged and still blocks anon/customer access to others).
create index if not exists appointments_invoice_token_idx
  on public.appointments (invoice_token)
  where invoice_token is not null;
