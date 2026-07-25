-- Pikavolt LLC — initial schema
-- All objects live in public unless noted. Money columns are integer cents.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
-- FROZEN CONTRACT: these values are shared verbatim with the TypeScript layer.
create type public.appointment_status as enum (
  'requested',
  'confirmed',
  'en_route',
  'in_progress',
  'completed',
  'closed',
  'cancelled',
  'no_show'
);

-- ---------------------------------------------------------------------------
-- Generic updated_at trigger function
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- profiles ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'customer' check (role in ('customer', 'owner')),
  full_name text,
  phone text,
  email text,
  stripe_customer_id text unique,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- addresses -----------------------------------------------------------------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text,
  line1 text not null,
  line2 text,
  city text not null,
  state text not null default 'OH',
  zip text not null,
  lat double precision,
  lng double precision,
  property_type text not null default 'residential'
    check (property_type in ('residential', 'commercial', 'agricultural')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_user_id_idx on public.addresses (user_id);

-- service_categories ----------------------------------------------------------
create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- services --------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.service_categories (id) on delete set null,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_category_id_idx on public.services (category_id);

-- business_hours --------------------------------------------------------------
create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  day_of_week integer unique not null check (day_of_week between 0 and 6),
  opens_at time,
  closes_at time,
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- blocked_slots ---------------------------------------------------------------
create table public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- app_settings ----------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- appointments ----------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id),
  address_id uuid not null references public.addresses (id),
  status public.appointment_status not null default 'requested',
  is_emergency boolean not null default false,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  description text,
  job_notes text,
  service_call_fee_cents integer not null default 15000,
  job_total_cents integer,
  promo_code text,
  discount_cents integer not null default 0,
  auto_charge_consent boolean not null default false,
  terms_accepted_at timestamptz,
  cancelled_reason text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_no_overlap exclude using gist (
    tstzrange(scheduled_start, scheduled_end) with &&
  ) where (status not in ('cancelled', 'no_show'))
);
create index appointments_customer_id_idx on public.appointments (customer_id);
create index appointments_status_idx on public.appointments (status);
create index appointments_scheduled_start_idx on public.appointments (scheduled_start);

-- appointment_services ----------------------------------------------------------
create table public.appointment_services (
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  service_id uuid not null references public.services (id),
  custom_note text,
  created_at timestamptz not null default now(),
  primary key (appointment_id, service_id)
);

-- appointment_events -------------------------------------------------------------
create table public.appointment_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  actor_id uuid,
  from_status public.appointment_status,
  to_status public.appointment_status,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index appointment_events_appointment_id_idx on public.appointment_events (appointment_id);

-- payments -------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id),
  kind text check (kind in ('deposit', 'final', 'extra')),
  amount_cents integer not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'succeeded', 'failed', 'refunded')),
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  promo_code text,
  discount_cents integer not null default 0,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_appointment_id_idx on public.payments (appointment_id);

-- stripe_events ----------------------------------------------------------------------
create table public.stripe_events (
  id text primary key,
  type text,
  processed_at timestamptz not null default now()
);

-- promotions --------------------------------------------------------------------------
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  stripe_coupon_id text,
  stripe_promotion_code_id text unique,
  code text unique not null,
  percent_off numeric,
  amount_off_cents integer,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- site_banners ---------------------------------------------------------------------------
create table public.site_banners (
  id uuid primary key default gen_random_uuid(),
  headline text not null,
  body text,
  cta_text text,
  cta_url text,
  theme text not null default 'volt' check (theme in ('volt', 'storm', 'emergency')),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- sweepstakes -------------------------------------------------------------------------------
create table public.sweepstakes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  prize text,
  rules_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  winner_entry_id uuid,
  drawn_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- sweepstakes_entries --------------------------------------------------------------------------
create table public.sweepstakes_entries (
  id uuid primary key default gen_random_uuid(),
  sweepstakes_id uuid not null references public.sweepstakes (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  zip text,
  created_at timestamptz not null default now(),
  unique (sweepstakes_id, email)
);

-- winner FK added after both tables exist
alter table public.sweepstakes
  add constraint sweepstakes_winner_entry_id_fkey
  foreign key (winner_entry_id) references public.sweepstakes_entries (id) on delete set null;

-- conversations ---------------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  visitor_name text,
  visitor_email text,
  last_message_at timestamptz,
  last_message_preview text,
  customer_unread integer not null default 0,
  owner_unread integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_customer_id_idx on public.conversations (customer_id);

-- messages ----------------------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  sender_role text not null check (sender_role in ('customer', 'owner')),
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_conversation_id_idx on public.messages (conversation_id);

-- tracking_sessions ----------------------------------------------------------------------------------
create table public.tracking_sessions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid unique not null references public.appointments (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_lat double precision,
  last_lng double precision,
  last_heading real,
  last_ping_at timestamptz,
  eta_seconds integer,
  eta_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- device_tokens -----------------------------------------------------------------------------------------
create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  fcm_token text unique not null,
  platform text check (platform in ('ios', 'android', 'web')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index device_tokens_user_id_idx on public.device_tokens (user_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers on every table that has an updated_at column
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'updated_at'
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Functions & triggers
-- ---------------------------------------------------------------------------

-- New auth user -> profile row -----------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- is_owner() ------------------------------------------------------------------
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

-- Block clients from changing their own role -----------------------------------
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and current_user in ('anon', 'authenticated') then
    raise exception 'changing profile role is not allowed';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Appointment status state machine ---------------------------------------------
create or replace function public.enforce_appointment_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if (old.status = 'requested'   and new.status in ('confirmed', 'cancelled'))
  or (old.status = 'confirmed'   and new.status in ('en_route', 'cancelled'))
  or (old.status = 'en_route'    and new.status in ('in_progress', 'cancelled', 'no_show'))
  or (old.status = 'in_progress' and new.status in ('completed', 'no_show', 'cancelled'))
  or (old.status = 'completed'   and new.status = 'closed')
  then
    if new.status = 'completed' and new.completed_at is null then
      new.completed_at := now();
    end if;
    return new;
  end if;

  raise exception 'invalid appointment status transition: % -> %', old.status, new.status;
end;
$$;

create trigger appointments_enforce_transition
  before update of status on public.appointments
  for each row execute function public.enforce_appointment_transition();

-- Audit log of status changes ----------------------------------------------------
create or replace function public.log_appointment_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.appointment_events (appointment_id, actor_id, from_status, to_status)
    values (new.id, auth.uid(), null, new.status);
  elsif old.status is distinct from new.status then
    insert into public.appointment_events (appointment_id, actor_id, from_status, to_status)
    values (new.id, auth.uid(), old.status, new.status);
  end if;
  return new;
end;
$$;

create trigger appointments_log_event
  after insert or update of status on public.appointments
  for each row execute function public.log_appointment_event();

-- Message insert -> bump conversation ---------------------------------------------
create or replace function public.bump_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at,
      last_message_preview = left(new.body, 120),
      owner_unread = owner_unread + (case when new.sender_role = 'customer' then 1 else 0 end),
      customer_unread = customer_unread + (case when new.sender_role = 'owner' then 1 else 0 end)
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation_on_message();

-- mark_conversation_read RPC ---------------------------------------------------------
create or replace function public.mark_conversation_read(p_conversation_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
begin
  select customer_id into v_customer_id
  from public.conversations
  where id = p_conversation_id;

  if v_customer_id is null then
    raise exception 'conversation not found';
  end if;

  if p_role = 'customer' then
    if auth.uid() is null or auth.uid() <> v_customer_id then
      raise exception 'not authorized';
    end if;
    update public.conversations
      set customer_unread = 0
      where id = p_conversation_id;
    update public.messages
      set read_at = now()
      where conversation_id = p_conversation_id
        and sender_role = 'owner'
        and read_at is null;
  elsif p_role = 'owner' then
    if not public.is_owner() then
      raise exception 'not authorized';
    end if;
    update public.conversations
      set owner_unread = 0
      where id = p_conversation_id;
    update public.messages
      set read_at = now()
      where conversation_id = p_conversation_id
        and sender_role = 'customer'
        and read_at is null;
  else
    raise exception 'invalid role: %', p_role;
  end if;
end;
$$;

revoke execute on function public.mark_conversation_read(uuid, text) from public, anon;
grant execute on function public.mark_conversation_read(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- The local stack's default privileges do not grant DML to the API roles, so
-- grant explicitly; RLS below is what actually gates row access.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;
grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

grant execute on function public.is_owner() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.business_hours enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.app_settings enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_services enable row level security;
alter table public.appointment_events enable row level security;
alter table public.payments enable row level security;
alter table public.stripe_events enable row level security;
alter table public.promotions enable row level security;
alter table public.site_banners enable row level security;
alter table public.sweepstakes enable row level security;
alter table public.sweepstakes_entries enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.tracking_sessions enable row level security;
alter table public.device_tokens enable row level security;

-- profiles ---------------------------------------------------------------------
create policy "profiles: user selects own" on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy "profiles: user updates own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
  -- role changes rejected by profiles_protect_role trigger

create policy "profiles: owner selects all" on public.profiles
  for select to authenticated
  using (public.is_owner());

-- addresses --------------------------------------------------------------------
create policy "addresses: owner all" on public.addresses
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy "addresses: user select own" on public.addresses
  for select to authenticated
  using (user_id = auth.uid());

create policy "addresses: user insert own" on public.addresses
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "addresses: user update own" on public.addresses
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "addresses: user delete own" on public.addresses
  for delete to authenticated
  using (user_id = auth.uid());

-- catalog / public-read tables ----------------------------------------------------
create policy "service_categories: public read" on public.service_categories
  for select to anon, authenticated
  using (true);

create policy "service_categories: owner all" on public.service_categories
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy "services: public read" on public.services
  for select to anon, authenticated
  using (true);

create policy "services: owner all" on public.services
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy "business_hours: public read" on public.business_hours
  for select to anon, authenticated
  using (true);

create policy "business_hours: owner all" on public.business_hours
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy "app_settings: public read" on public.app_settings
  for select to anon, authenticated
  using (true);  -- app_settings holds only non-secret values

create policy "app_settings: owner all" on public.app_settings
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy "site_banners: public read active window" on public.site_banners
  for select to anon, authenticated
  using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

create policy "site_banners: owner all" on public.site_banners
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy "sweepstakes: public read active" on public.sweepstakes
  for select to anon, authenticated
  using (is_active);

create policy "sweepstakes: owner all" on public.sweepstakes
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- blocked_slots --------------------------------------------------------------------
create policy "blocked_slots: public read" on public.blocked_slots
  for select to anon, authenticated
  using (true);

create policy "blocked_slots: owner all" on public.blocked_slots
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- appointments -----------------------------------------------------------------------
create policy "appointments: customer select own" on public.appointments
  for select to authenticated
  using (customer_id = auth.uid());

create policy "appointments: customer insert requested" on public.appointments
  for insert to authenticated
  with check (customer_id = auth.uid() and status = 'requested');

-- customers may only move their own requested/confirmed appointment to cancelled;
-- the transition trigger enforces the legal state machine on top of this.
create policy "appointments: customer cancel own" on public.appointments
  for update to authenticated
  using (customer_id = auth.uid() and status in ('requested', 'confirmed'))
  with check (customer_id = auth.uid() and status = 'cancelled');

create policy "appointments: owner all" on public.appointments
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- appointment_services -------------------------------------------------------------------
create policy "appointment_services: customer select own" on public.appointment_services
  for select to authenticated
  using (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.customer_id = auth.uid()
    )
  );

create policy "appointment_services: customer insert own" on public.appointment_services
  for insert to authenticated
  with check (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.customer_id = auth.uid()
    )
  );

create policy "appointment_services: owner all" on public.appointment_services
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- appointment_events (read-only for clients) ------------------------------------------------
create policy "appointment_events: participants select" on public.appointment_events
  for select to authenticated
  using (
    public.is_owner()
    or exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.customer_id = auth.uid()
    )
  );

-- payments (service-role writes only) -----------------------------------------------------------
create policy "payments: customer select own" on public.payments
  for select to authenticated
  using (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.customer_id = auth.uid()
    )
  );

create policy "payments: owner select all" on public.payments
  for select to authenticated
  using (public.is_owner());

-- stripe_events (service-role writes only) ---------------------------------------------------------
create policy "stripe_events: owner select" on public.stripe_events
  for select to authenticated
  using (public.is_owner());

-- promotions (service-role writes only) --------------------------------------------------------------
create policy "promotions: owner select" on public.promotions
  for select to authenticated
  using (public.is_owner());

-- sweepstakes_entries -----------------------------------------------------------------------------------
create policy "sweepstakes_entries: public insert" on public.sweepstakes_entries
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

create policy "sweepstakes_entries: entrant select own" on public.sweepstakes_entries
  for select to authenticated
  using (user_id = auth.uid());

create policy "sweepstakes_entries: owner all" on public.sweepstakes_entries
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- conversations --------------------------------------------------------------------------------------------
create policy "conversations: participant select" on public.conversations
  for select to authenticated
  using (customer_id = auth.uid() or public.is_owner());

create policy "conversations: participant update" on public.conversations
  for update to authenticated
  using (customer_id = auth.uid() or public.is_owner())
  with check (customer_id = auth.uid() or public.is_owner());

create policy "conversations: customer insert own" on public.conversations
  for insert to authenticated
  with check (customer_id = auth.uid());

-- messages --------------------------------------------------------------------------------------------------
create policy "messages: participant select" on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.customer_id = auth.uid() or public.is_owner())
    )
  );

create policy "messages: participant insert" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and ((sender_role = 'owner') = public.is_owner())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.customer_id = auth.uid() or public.is_owner())
    )
  );

-- tracking_sessions -------------------------------------------------------------------------------------------
create policy "tracking_sessions: participant select" on public.tracking_sessions
  for select to authenticated
  using (
    public.is_owner()
    or exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.customer_id = auth.uid()
    )
  );

create policy "tracking_sessions: owner insert" on public.tracking_sessions
  for insert to authenticated
  with check (public.is_owner());

create policy "tracking_sessions: owner update" on public.tracking_sessions
  for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- device_tokens --------------------------------------------------------------------------------------------------
create policy "device_tokens: user select own" on public.device_tokens
  for select to authenticated
  using (user_id = auth.uid());

create policy "device_tokens: user insert own" on public.device_tokens
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "device_tokens: user update own" on public.device_tokens
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "device_tokens: user delete own" on public.device_tokens
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;

-- Broadcast channel authorization for live tracking.
-- Topic format: 'tracking:{appointment_id}'. Readable/writable only by the
-- owner or that appointment's customer. Wrapped in guarded DO blocks so the
-- migration still applies if the local stack's realtime schema differs
-- (documented fallback per spec).
do $$
begin
  execute $pol$
    create policy "tracking broadcast: participants read" on realtime.messages
      for select to authenticated
      using (
        realtime.messages.extension = 'broadcast'
        and split_part(realtime.topic(), ':', 1) = 'tracking'
        and split_part(realtime.topic(), ':', 2)
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and exists (
          select 1 from public.appointments a
          where a.id = split_part(realtime.topic(), ':', 2)::uuid
            and (public.is_owner() or a.customer_id = auth.uid())
        )
      )
  $pol$;
exception when others then
  raise notice 'skipping realtime.messages select policy: %', sqlerrm;
end;
$$;

do $$
begin
  execute $pol$
    create policy "tracking broadcast: participants write" on realtime.messages
      for insert to authenticated
      with check (
        realtime.messages.extension = 'broadcast'
        and split_part(realtime.topic(), ':', 1) = 'tracking'
        and split_part(realtime.topic(), ':', 2)
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and exists (
          select 1 from public.appointments a
          where a.id = split_part(realtime.topic(), ':', 2)::uuid
            and (public.is_owner() or a.customer_id = auth.uid())
        )
      )
  $pol$;
exception when others then
  raise notice 'skipping realtime.messages insert policy: %', sqlerrm;
end;
$$;
