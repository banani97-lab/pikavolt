import type { Metadata } from 'next';
import { Container } from '@/components/ui/Container';
import { ChatInbox } from './ChatInbox';

export const metadata: Metadata = { title: 'Chat' };

/**
 * Owner chat inbox. Access is enforced by middleware (profiles.role='owner');
 * RLS backs it up at the data layer.
 */
export default function AdminChatPage() {
  return (
    <Container className="py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl uppercase tracking-wide text-white">
          Chat
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Live conversations with customers and site visitors.
        </p>
      </div>
      <ChatInbox />
    </Container>
  );
}
