-- Pikavolt LLC — chat message webhook
--
-- AFTER INSERT trigger on public.messages that POSTs the standard Supabase
-- DB-webhook payload ({type, table, schema, record, old_record}) to the web
-- app's /api/hooks/message-created endpoint, which dispatches push
-- notifications (customer message -> owner devices, owner message -> that
-- conversation's customer devices).
--
-- LOCAL: uses supabase_functions.http_request (pg_net under the hood) — the
-- same mechanism the Dashboard's "Database Webhooks" feature generates. The
-- URL targets host.docker.internal:3000 because Postgres runs inside Docker
-- while `next dev` runs on the host, and the x-webhook-secret value matches
-- SUPABASE_DB_WEBHOOK_SECRET in apps/web/.env.local (a local-dev-only value;
-- no production secret lives in this file).
--
-- PRODUCTION: do NOT rely on this trigger's hardcoded local URL/secret.
-- Configure a Database Webhook in the Supabase Dashboard (Database ->
-- Webhooks) on INSERT of public.messages pointing at
--   https://<site>/api/hooks/message-created
-- with an `x-webhook-secret` header equal to the production
-- SUPABASE_DB_WEBHOOK_SECRET. The guarded block below is a no-op wherever the
-- supabase_functions schema is unavailable, so this migration applies cleanly
-- in any environment.

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'supabase_functions'
      and p.proname = 'http_request'
  ) then
    execute 'drop trigger if exists messages_webhook_message_created on public.messages';
    execute $trg$
      create trigger messages_webhook_message_created
        after insert on public.messages
        for each row
        execute function supabase_functions.http_request(
          'http://host.docker.internal:3000/api/hooks/message-created',
          'POST',
          '{"Content-Type":"application/json","x-webhook-secret":"local-dev-hook-secret"}',
          '{}',
          '5000'
        )
    $trg$;
  else
    raise notice
      'supabase_functions.http_request unavailable — skipping messages webhook trigger; configure a Dashboard Database Webhook instead.';
  end if;
end;
$$;
