'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, X, Zap } from 'lucide-react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  CONVERSATION_HINT_KEY,
  formatTime,
  groupMessagesByDay,
  upsertMessage,
  type ConversationRow,
  type MessageRow,
} from './chat-shared';

/**
 * Pikavolt live chat widget.
 * Collapsed: the mascot face as a floating action button (volt ring + pulse,
 * unread badge). Open: a branded panel backed by Supabase realtime chat with
 * the owner. Anonymous visitors sign in via supabase anonymous auth on their
 * first message.
 */
export default function ChatWidget() {
  const pathname = usePathname();
  // The owner answers chat from /admin/chat — don't float the customer
  // widget over the admin console.
  if (pathname?.startsWith('/admin')) return null;
  return <ChatWidgetInner />;
}

/** Find the visitor's open conversation: localStorage hint first, then query. */
async function findOpenConversation(
  supabase: SupabaseClient,
  userId: string,
): Promise<ConversationRow | null> {
  const hint = window.localStorage.getItem(CONVERSATION_HINT_KEY);
  if (hint) {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', hint)
      .maybeSingle();
    const convo = data as ConversationRow | null;
    if (convo && convo.customer_id === userId && convo.status === 'open') {
      return convo;
    }
    // Hint belongs to a previous (e.g. anonymous) identity or a closed
    // thread — drop it and fall through to a fresh lookup.
    // TODO(auth): when signup wires supabase.auth.linkIdentity() for
    // anonymous users, carry the conversation across the upgrade instead
    // of starting fresh.
    window.localStorage.removeItem(CONVERSATION_HINT_KEY);
  }
  const { data } = await supabase
    .from('conversations')
    .select('*')
    .eq('customer_id', userId)
    .eq('status', 'open')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return (data as ConversationRow | null) ?? null;
}

function ChatWidgetInner() {
  const [supabase] = useState(createClient);
  const [open, setOpen] = useState(false);
  const [booted, setBooted] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [conversation, setConversation] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<ConversationRow | null>(null);
  conversationRef.current = conversation;

  const conversationId = conversation?.id ?? null;
  const unread = conversation?.customer_unread ?? 0;

  // Boot: restore auth session and any open conversation.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { session: restored },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(restored);
      if (restored) {
        // supabase-js only forwards tokens to realtime on SIGNED_IN /
        // TOKEN_REFRESHED; a restored session emits INITIAL_SESSION, so set
        // it explicitly or RLS-gated postgres_changes deliver nothing.
        await supabase.realtime.setAuth(restored.access_token);
        const convo = await findOpenConversation(supabase, restored.user.id);
        if (!cancelled && convo) {
          setConversation(convo);
          window.localStorage.setItem(CONVERSATION_HINT_KEY, convo.id);
        }
      }
      if (!cancelled) setBooted(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Live conversation row (unread counter, status) — keeps the collapsed
  // badge fresh while the panel is closed.
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`chat-conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${conversationId}`,
        },
        (payload) => setConversation(payload.new as ConversationRow),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, conversationId]);

  // While open: load history + live INSERTs for this conversation.
  useEffect(() => {
    if (!open || !conversationId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (!cancelled && data) {
        setMessages((prev) =>
          (data as MessageRow[]).reduce(
            (acc, m) => upsertMessage(acc, m),
            prev.filter((m) => m.conversation_id === conversationId),
          ),
        );
      }
    })();
    const channel = supabase
      .channel(`chat-messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => setMessages((prev) => upsertMessage(prev, payload.new as MessageRow)),
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, open, conversationId]);

  // Panel open with unread owner messages -> mark read (customer side).
  // NB: supabase builders are lazy thenables — they only execute once
  // awaited/.then()'d, so a bare `void rpc(...)` would silently do nothing.
  useEffect(() => {
    if (!open || !conversationId || unread === 0) return;
    void supabase
      .rpc('mark_conversation_read', {
        p_conversation_id: conversationId,
        p_role: 'customer',
      })
      .then(({ error: rpcError }) => {
        if (rpcError) console.error('mark_conversation_read failed:', rpcError.message);
      });
  }, [supabase, open, conversationId, unread]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  /** Anonymous sign-in (if needed) + conversation insert, exactly once. */
  const ensureConversation = useCallback(async (): Promise<ConversationRow> => {
    if (conversationRef.current) return conversationRef.current;

    let activeSession = session;
    if (!activeSession) {
      const { data, error: authError } = await supabase.auth.signInAnonymously({
        options: { data: { full_name: visitorName.trim() || null } },
      });
      if (authError || !data.session) {
        throw new Error(authError?.message ?? 'Could not start a chat session.');
      }
      activeSession = data.session;
      setSession(activeSession);
      await supabase.realtime.setAuth(activeSession.access_token);
    }

    const { data: convo, error: convoError } = await supabase
      .from('conversations')
      .insert({
        customer_id: activeSession.user.id,
        visitor_name: visitorName.trim() || null,
        visitor_email: visitorEmail.trim() || null,
      })
      .select()
      .single();
    if (convoError || !convo) {
      throw new Error(convoError?.message ?? 'Could not start the conversation.');
    }
    const row = convo as ConversationRow;
    setConversation(row);
    window.localStorage.setItem(CONVERSATION_HINT_KEY, row.id);
    return row;
  }, [supabase, session, visitorName, visitorEmail]);

  const handleSend = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending) return;
    if (!session && !visitorName.trim()) {
      setError('Please tell us your name first.');
      return;
    }
    setSending(true);
    setError(null);
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const convo = await ensureConversation();
      const optimistic: MessageRow = {
        id: tempId,
        conversation_id: convo.id,
        sender_id: convo.customer_id,
        sender_role: 'customer',
        body,
        read_at: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setDraft('');
      const { data, error: sendError } = await supabase
        .from('messages')
        .insert({
          conversation_id: convo.id,
          sender_id: convo.customer_id,
          sender_role: 'customer',
          body,
        })
        .select()
        .single();
      if (sendError || !data) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setDraft(body);
        setError('Message failed to send. Please try again.');
      } else {
        setMessages((prev) =>
          upsertMessage(
            prev.filter((m) => m.id !== tempId),
            data as MessageRow,
          ),
        );
      }
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSending(false);
    }
  }, [draft, sending, session, visitorName, ensureConversation, supabase]);

  const needsIntro = booted && !session;
  const groups = groupMessagesByDay(messages);

  return (
    <AnimatePresence>
      {!open ? (
        <motion.button
          key="chat-launcher"
          type="button"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setOpen(true)}
          aria-label={
            unread > 0 ? `Open chat, ${unread} unread messages` : 'Open chat with Pikavolt'
          }
          className="fixed bottom-5 right-5 z-50 h-16 w-16 rounded-full ring-2 ring-volt shadow-volt-glow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-volt/70"
        >
          {/* Gentle electric pulse */}
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full ring-2 ring-volt"
            animate={{ scale: [1, 1.35], opacity: [0.55, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
          />
          <Image
            src="/mascot-face.png"
            alt=""
            width={64}
            height={64}
            className="h-full w-full rounded-full object-cover"
          />
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-emergency px-1.5 text-xs font-bold text-white ring-2 ring-storm"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </motion.button>
      ) : (
        <motion.div
          key="chat-panel"
          role="dialog"
          aria-label="Chat with Pikavolt"
          initial={{ opacity: 0, y: 32, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 32, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="fixed z-50 flex flex-col overflow-hidden border border-white/10 bg-surface shadow-2xl max-sm:inset-x-0 max-sm:bottom-0 max-sm:h-[85dvh] max-sm:rounded-t-2xl sm:bottom-5 sm:right-5 sm:h-[min(620px,calc(100dvh-5rem))] sm:w-[380px] sm:rounded-2xl"
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-white/10 bg-gradient-to-r from-[#1b4254] to-[#0c2830] px-4 py-3">
            <span className="relative shrink-0">
              <Image
                src="/mascot-face.png"
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 rounded-full object-cover ring-2 ring-volt/70"
              />
              <span
                aria-hidden
                className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-[#12333d]"
              />
            </span>
            <div className="min-w-0">
              <p className="font-display text-lg uppercase leading-tight tracking-wide text-white">
                Pikavolt
              </p>
              <p className="flex items-center gap-1 text-xs text-zinc-300">
                <Zap aria-hidden className="h-3 w-3 text-volt" />
                We usually reply fast
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="ml-auto rounded-full p-2 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/60"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={listRef}
            className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
            aria-live="polite"
          >
            {needsIntro && messages.length === 0 ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Image
                    src="/mascot-face.png"
                    alt=""
                    width={28}
                    height={28}
                    className="mt-0.5 h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-volt/50"
                  />
                  <p className="rounded-2xl rounded-tl-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200">
                    Hey there! Tell us who you are and what you need — a real
                    electrician reads every message.
                  </p>
                </div>
                <div className="space-y-2 rounded-xl border border-white/10 bg-storm/60 p-3">
                  <label className="block text-xs font-medium text-zinc-400">
                    Your name <span className="text-volt">*</span>
                    <input
                      type="text"
                      value={visitorName}
                      onChange={(e) => setVisitorName(e.target.value)}
                      required
                      placeholder="Jane Doe"
                      className="mt-1 w-full rounded-lg border border-white/15 bg-surface px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-volt/60 focus:outline-none"
                    />
                  </label>
                  <label className="block text-xs font-medium text-zinc-400">
                    Email (optional)
                    <input
                      type="email"
                      value={visitorEmail}
                      onChange={(e) => setVisitorEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="mt-1 w-full rounded-lg border border-white/15 bg-surface px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-volt/60 focus:outline-none"
                    />
                  </label>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <Image
                  src="/mascot-face.png"
                  alt=""
                  width={72}
                  height={72}
                  className="h-18 w-18 rounded-full object-cover opacity-90 ring-2 ring-volt/40"
                />
                <p className="max-w-[220px] text-sm text-zinc-400">
                  Zap us a message — we&apos;ll get back to you in a flash.
                </p>
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.key} className="space-y-3">
                  <div
                    className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-zinc-500"
                    role="separator"
                  >
                    <span className="h-px flex-1 bg-white/10" />
                    {group.label}
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                  {group.messages.map((message) => {
                    const mine = message.sender_role === 'customer';
                    return (
                      <div
                        key={message.id}
                        className={cn('flex items-end gap-2', mine && 'flex-row-reverse')}
                      >
                        {!mine && (
                          <Image
                            src="/mascot-face.png"
                            alt="Pikavolt"
                            width={24}
                            height={24}
                            className="mb-4 h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-volt/50"
                          />
                        )}
                        <div className={cn('max-w-[78%]', mine && 'text-right')}>
                          <div
                            className={cn(
                              'inline-block whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-left text-sm',
                              mine
                                ? 'rounded-br-sm border border-volt/25 bg-volt/15 text-white'
                                : 'rounded-bl-sm border border-white/10 bg-white/5 text-zinc-100',
                            )}
                          >
                            {message.body}
                          </div>
                          <p className="mt-1 text-[10px] text-zinc-500">
                            {formatTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="border-t border-white/10 bg-storm/40 p-3"
          >
            {error && (
              <p role="alert" className="mb-2 text-xs text-emergency">
                {error}
              </p>
            )}
            <div className="flex items-end gap-2">
              <textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Type a message…"
                aria-label="Message"
                className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-white/15 bg-surface px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-volt/60 focus:outline-none"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-volt text-storm transition-all hover:shadow-volt-glow disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/60"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
