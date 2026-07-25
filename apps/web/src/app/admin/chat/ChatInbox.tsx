'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { formatDistanceToNowStrict } from 'date-fns';
import { ArchiveRestore, ArchiveX, ChevronLeft, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  formatTime,
  groupMessagesByDay,
  upsertMessage,
  type ConversationRow,
  type MessageRow,
} from '@/components/chat/chat-shared';

interface AdminConversation extends ConversationRow {
  profile?: { full_name: string | null; email: string | null } | null;
}

type StatusFilter = 'open' | 'closed';

function displayName(c: AdminConversation): string {
  return c.visitor_name || c.profile?.full_name || 'Visitor';
}

function sortConversations(list: AdminConversation[]): AdminConversation[] {
  return [...list].sort((a, b) =>
    (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at),
  );
}

/**
 * Owner chat inbox — two-pane realtime console over conversations/messages.
 * /admin is middleware-gated to profiles.role === 'owner'.
 */
export function ChatInbox() {
  const [supabase] = useState(createClient);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('open');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  // Boot: owner id + full conversation list (with customer profile names).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled) setOwnerId(session?.user.id ?? null);
      if (session) {
        // Restored sessions emit INITIAL_SESSION, which supabase-js does not
        // forward to realtime — set the token explicitly so RLS-gated
        // postgres_changes subscriptions actually receive events.
        await supabase.realtime.setAuth(session.access_token);
      }

      const { data } = await supabase
        .from('conversations')
        .select('*, profile:profiles!conversations_customer_id_fkey(full_name, email)')
        .order('last_message_at', { ascending: false, nullsFirst: false });
      if (!cancelled) {
        setConversations(sortConversations((data as AdminConversation[] | null) ?? []));
        setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  /** Attach the customer's profile name to a conversation that arrived via realtime. */
  const hydrateProfile = useCallback(
    async (conversationId: string, customerId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', customerId)
        .maybeSingle();
      if (data) {
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, profile: data } : c)),
        );
      }
    },
    [supabase],
  );

  // Realtime: conversation INSERTs (new chats) + UPDATEs (previews, unread, status).
  useEffect(() => {
    const channel = supabase
      .channel('admin-chat-conversations')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        (payload) => {
          const row = payload.new as AdminConversation;
          setConversations((prev) =>
            sortConversations([row, ...prev.filter((c) => c.id !== row.id)]),
          );
          void hydrateProfile(row.id, row.customer_id);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        (payload) => {
          const row = payload.new as ConversationRow;
          setConversations((prev) =>
            sortConversations(prev.map((c) => (c.id === row.id ? { ...c, ...row } : c))),
          );
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, hydrateProfile]);

  // Thread: history + live INSERTs for the selected conversation.
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setMessages([]);
    void (async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', selectedId)
        .order('created_at', { ascending: true });
      if (!cancelled && data) setMessages(data as MessageRow[]);
    })();
    const channel = supabase
      .channel(`admin-chat-messages-${selectedId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedId}`,
        },
        (payload) => setMessages((prev) => upsertMessage(prev, payload.new as MessageRow)),
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, selectedId]);

  // Open thread with unread customer messages -> mark read (owner side).
  const selectedUnread = selected?.owner_unread ?? 0;
  // NB: supabase builders are lazy thenables — they only execute once
  // awaited/.then()'d, so a bare `void rpc(...)` would silently do nothing.
  useEffect(() => {
    if (!selectedId || selectedUnread === 0) return;
    void supabase
      .rpc('mark_conversation_read', {
        p_conversation_id: selectedId,
        p_role: 'owner',
      })
      .then(({ error: rpcError }) => {
        if (rpcError) console.error('mark_conversation_read failed:', rpcError.message);
      });
  }, [supabase, selectedId, selectedUnread]);

  // Auto-scroll thread.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSend = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending || !selectedId || !ownerId) return;
    setSending(true);
    setError(null);
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: MessageRow = {
      id: tempId,
      conversation_id: selectedId,
      sender_id: ownerId,
      sender_role: 'owner',
      body,
      read_at: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');
    const { data, error: sendError } = await supabase
      .from('messages')
      .insert({
        conversation_id: selectedId,
        sender_id: ownerId,
        sender_role: 'owner',
        body,
      })
      .select()
      .single();
    if (sendError || !data) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(body);
      setError('Reply failed to send. Please try again.');
    } else {
      setMessages((prev) =>
        upsertMessage(
          prev.filter((m) => m.id !== tempId),
          data as MessageRow,
        ),
      );
    }
    setSending(false);
  }, [draft, sending, selectedId, ownerId, supabase]);

  const toggleStatus = useCallback(async () => {
    if (!selected) return;
    const next = selected.status === 'open' ? 'closed' : 'open';
    setConversations((prev) =>
      prev.map((c) => (c.id === selected.id ? { ...c, status: next } : c)),
    );
    const { error: updateError } = await supabase
      .from('conversations')
      .update({ status: next })
      .eq('id', selected.id);
    if (updateError) {
      setConversations((prev) =>
        prev.map((c) => (c.id === selected.id ? { ...c, status: selected.status } : c)),
      );
      setError('Could not update conversation status.');
    }
  }, [selected, supabase]);

  const filtered = conversations.filter((c) => c.status === filter);
  const openCount = conversations.filter((c) => c.status === 'open').length;
  const closedCount = conversations.length - openCount;
  const groups = groupMessagesByDay(messages);

  return (
    <div className="flex h-[calc(100dvh-16rem)] min-h-[520px] overflow-hidden rounded-xl border border-white/10 bg-surface">
      {/* Conversation list */}
      <div
        className={cn(
          'flex w-full shrink-0 flex-col border-white/10 md:w-80 md:border-r',
          selectedId && 'max-md:hidden',
        )}
      >
        <div className="border-b border-white/10 p-3">
          <div className="flex gap-1 rounded-lg bg-storm/60 p-1" role="tablist" aria-label="Conversation status filter">
            {(['open', 'closed'] as const).map((status) => (
              <button
                key={status}
                type="button"
                role="tab"
                aria-selected={filter === status}
                onClick={() => setFilter(status)}
                className={cn(
                  'flex-1 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors',
                  filter === status
                    ? 'bg-volt/15 text-volt'
                    : 'text-zinc-400 hover:text-white',
                )}
              >
                {status} ({status === 'open' ? openCount : closedCount})
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <p className="p-4 text-sm text-zinc-500">Loading conversations…</p>
          ) : filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <Image
                src="/mascot-face.png"
                alt=""
                width={80}
                height={80}
                className="h-20 w-20 rounded-full object-cover opacity-80 ring-2 ring-volt/40"
              />
              <p className="font-display text-lg uppercase tracking-wide text-zinc-300">
                All quiet on the wire
              </p>
              <p className="max-w-[220px] text-xs text-zinc-500">
                {filter === 'open'
                  ? 'No open conversations right now. New chats will spark up here instantly.'
                  : 'No closed conversations yet.'}
              </p>
            </div>
          ) : (
            <ul>
              {filtered.map((c) => {
                const name = displayName(c);
                const isAnon = !c.profile?.email && !c.visitor_email;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        'flex w-full items-start gap-3 border-b border-white/5 px-3 py-3 text-left transition-colors hover:bg-white/5',
                        selectedId === c.id && 'bg-volt/10 hover:bg-volt/10',
                      )}
                    >
                      {isAnon && name === 'Visitor' ? (
                        <Image
                          src="/mascot-face.png"
                          alt=""
                          width={36}
                          height={36}
                          className="h-9 w-9 shrink-0 rounded-full object-cover opacity-80 ring-1 ring-white/15"
                        />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1b4254] text-sm font-bold text-volt ring-1 ring-white/15">
                          {name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-white">
                            {name}
                          </span>
                          {c.last_message_at && (
                            <span className="shrink-0 text-[10px] text-zinc-500">
                              {formatDistanceToNowStrict(new Date(c.last_message_at), {
                                addSuffix: false,
                              })}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-zinc-400">
                            {c.last_message_preview ?? 'No messages yet'}
                          </span>
                          {c.owner_unread > 0 && (
                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-volt px-1.5 text-[10px] font-bold text-storm">
                              {c.owner_unread > 9 ? '9+' : c.owner_unread}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Thread pane */}
      <div className={cn('flex min-w-0 flex-1 flex-col', !selectedId && 'max-md:hidden')}>
        {!selected ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <Image
              src="/mascot-face.png"
              alt=""
              width={96}
              height={96}
              className="h-24 w-24 rounded-full object-cover opacity-80 ring-2 ring-volt/40"
            />
            <p className="font-display text-lg uppercase tracking-wide text-zinc-300">
              Pick a conversation
            </p>
            <p className="max-w-[260px] text-xs text-zinc-500">
              Select a chat from the list to read and reply in realtime.
            </p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 border-b border-white/10 bg-storm/40 px-4 py-3">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Back to conversation list"
                className="rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white md:hidden"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {displayName(selected)}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {selected.visitor_email || selected.profile?.email || 'Anonymous visitor'}
                  {' · '}
                  <span
                    className={cn(
                      selected.status === 'open' ? 'text-green-400' : 'text-zinc-400',
                    )}
                  >
                    {selected.status}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => void toggleStatus()}
                className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-volt/60 hover:text-volt"
              >
                {selected.status === 'open' ? (
                  <>
                    <ArchiveX className="h-3.5 w-3.5" /> Close
                  </>
                ) : (
                  <>
                    <ArchiveRestore className="h-3.5 w-3.5" /> Reopen
                  </>
                )}
              </button>
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
              {groups.map((group) => (
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
                    const mine = message.sender_role === 'owner';
                    return (
                      <div
                        key={message.id}
                        className={cn('flex items-end gap-2', mine && 'flex-row-reverse')}
                      >
                        {!mine && (
                          <span className="mb-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1b4254] text-[10px] font-bold text-volt">
                            {displayName(selected).charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className={cn('max-w-[72%]', mine && 'text-right')}>
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
              ))}
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
                  placeholder={`Reply to ${displayName(selected)}…`}
                  aria-label="Reply"
                  className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-white/15 bg-surface px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-volt/60 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  aria-label="Send reply"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-volt text-storm transition-all hover:shadow-volt-glow disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/60"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
