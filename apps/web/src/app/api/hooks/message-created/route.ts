import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPushToOwner, sendPushToUser } from '@/lib/notify/push';

/**
 * Supabase DB webhook: fired by an AFTER INSERT trigger on public.messages
 * (see packages/db/supabase/migrations/0002_chat_webhook.sql locally, or a
 * Dashboard-configured Database Webhook in production).
 *
 * Dispatches push notifications:
 *   customer message -> owner devices
 *   owner message    -> that conversation's customer devices
 *
 * Push is a console no-op when Firebase credentials are absent (local dev).
 */

interface MessageRecord {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_role: string;
  body: string;
  created_at: string;
}

interface WebhookPayload {
  type: string;
  table: string;
  schema: string;
  record: MessageRecord | null;
}

export async function POST(request: Request) {
  const secret = process.env.SUPABASE_DB_WEBHOOK_SECRET;
  if (!secret || request.headers.get('x-webhook-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as WebhookPayload | null;
  const record = payload?.record;
  if (
    !payload ||
    payload.type !== 'INSERT' ||
    payload.table !== 'messages' ||
    !record?.conversation_id ||
    typeof record.body !== 'string'
  ) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, customer_id, visitor_name')
    .eq('id', record.conversation_id)
    .maybeSingle();

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const preview =
    record.body.length > 120 ? `${record.body.slice(0, 117)}…` : record.body;
  const data = { conversationId: conversation.id };

  if (record.sender_role === 'customer') {
    let name: string | null = conversation.visitor_name;
    if (!name) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', conversation.customer_id)
        .maybeSingle();
      name = profile?.full_name ?? null;
    }
    const result = await sendPushToOwner({
      type: 'new_message',
      title: `New message from ${name ?? 'a visitor'}`,
      body: preview,
      data,
    });
    return NextResponse.json({ ok: true, target: 'owner', ...result });
  }

  if (record.sender_role === 'owner') {
    const result = await sendPushToUser(conversation.customer_id, {
      type: 'new_message',
      title: 'New message from Pikavolt',
      body: preview,
      data,
    });
    return NextResponse.json({ ok: true, target: 'customer', ...result });
  }

  return NextResponse.json({ error: 'Unknown sender_role' }, { status: 400 });
}
