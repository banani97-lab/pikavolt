'use client';

import dynamic from 'next/dynamic';

const ChatWidget = dynamic(() => import('./ChatWidget'), { ssr: false });

/** Client-side loader so the chat widget is code-split out of the shell. */
export function ChatWidgetLoader() {
  return <ChatWidget />;
}
