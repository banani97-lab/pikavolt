import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

export type PushType =
  | 'new_booking'
  | 'booking_confirmed'
  | 'tech_en_route'
  | 'tech_arrived'
  | 'final_payment_due'
  | 'payment_receipt'
  | 'new_message';

export interface PushPayload {
  type: PushType;
  title: string;
  body: string;
  /** deep-link data, e.g. { appointmentId } or { conversationId } */
  data?: Record<string, string>;
}

let messaging: import('firebase-admin/messaging').Messaging | null | undefined;

async function getMessaging() {
  if (messaging !== undefined) return messaging;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    messaging = null; // Firebase not configured (local dev) — push becomes a no-op
    return messaging;
  }
  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getMessaging: gm } = await import('firebase-admin/messaging');
  const app =
    getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(raw)) });
  messaging = gm(app);
  return messaging;
}

/**
 * Send a push notification to every registered device of a user.
 * No-ops (with a console.info) when Firebase credentials are absent so local
 * dev and tests never require FCM. Prunes tokens FCM reports as invalid.
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  const supabase = createAdminClient();
  const { data: tokens } = await supabase
    .from('device_tokens')
    .select('fcm_token')
    .eq('user_id', userId);

  if (!tokens?.length) return { sent: 0 };

  const fcm = await getMessaging();
  if (!fcm) {
    console.info(`[push:noop] ${payload.type} → user ${userId}: ${payload.title}`);
    return { sent: 0, noop: true };
  }

  const res = await fcm.sendEachForMulticast({
    tokens: tokens.map((t) => t.fcm_token),
    notification: { title: payload.title, body: payload.body },
    data: { type: payload.type, ...payload.data },
  });

  const invalid = tokens.filter((_, i) => {
    const err = res.responses[i]?.error?.code;
    return (
      err === 'messaging/registration-token-not-registered' ||
      err === 'messaging/invalid-argument'
    );
  });
  if (invalid.length) {
    await supabase
      .from('device_tokens')
      .delete()
      .in('fcm_token', invalid.map((t) => t.fcm_token));
  }
  return { sent: res.successCount };
}

/** Push to the owner (all profiles with role='owner'). */
export async function sendPushToOwner(payload: PushPayload) {
  const supabase = createAdminClient();
  const { data: owners } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'owner');
  let sent = 0;
  for (const o of owners ?? []) {
    const r = await sendPushToUser(o.id, payload);
    sent += r.sent;
  }
  return { sent };
}
