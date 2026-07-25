import { format, isSameDay, isToday, isYesterday } from 'date-fns';

/**
 * Shared chat types + helpers for the customer widget and the admin inbox.
 * Row shapes mirror packages/db/supabase/migrations/0001_init.sql.
 */

/** localStorage hint so a returning visitor lands back in their conversation. */
export const CONVERSATION_HINT_KEY = 'pikavolt-chat-conversation-id';

export interface ConversationRow {
  id: string;
  customer_id: string;
  status: 'open' | 'closed' | string;
  visitor_name: string | null;
  visitor_email: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  customer_unread: number;
  owner_unread: number;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_role: 'customer' | 'owner' | string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export function formatTime(iso: string): string {
  return format(new Date(iso), 'h:mm a');
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d, yyyy');
}

export interface MessageDayGroup {
  key: string;
  label: string;
  messages: MessageRow[];
}

/** Group an already-sorted message list into per-day buckets for separators. */
export function groupMessagesByDay(messages: MessageRow[]): MessageDayGroup[] {
  const groups: MessageDayGroup[] = [];
  for (const message of messages) {
    const last = groups[groups.length - 1];
    const lastFirst = last?.messages[0];
    if (
      last &&
      lastFirst &&
      isSameDay(new Date(lastFirst.created_at), new Date(message.created_at))
    ) {
      last.messages.push(message);
    } else {
      groups.push({
        key: `${message.created_at.slice(0, 10)}-${groups.length}`,
        label: dayLabel(message.created_at),
        messages: [message],
      });
    }
  }
  return groups;
}

/** Insert-or-replace a message by id, keeping the list sorted by created_at. */
export function upsertMessage(prev: MessageRow[], msg: MessageRow): MessageRow[] {
  if (prev.some((m) => m.id === msg.id)) {
    return prev.map((m) => (m.id === msg.id ? msg : m));
  }
  return [...prev, msg].sort((a, b) => a.created_at.localeCompare(b.created_at));
}
