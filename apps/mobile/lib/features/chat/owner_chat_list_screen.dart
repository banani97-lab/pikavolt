import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../core/theme.dart';
import '../../core/widgets/mascot.dart';
import '../booking/slot_utils.dart';
import '../owner/owner_chat_providers.dart';

/// Owner conversation inbox (/owner/chat): open/closed filter, unread badges,
/// realtime reorder, tap-through to the thread.
class OwnerChatListScreen extends ConsumerStatefulWidget {
  const OwnerChatListScreen({super.key});

  @override
  ConsumerState<OwnerChatListScreen> createState() =>
      _OwnerChatListScreenState();
}

class _OwnerChatListScreenState extends ConsumerState<OwnerChatListScreen> {
  bool _showOpen = true;

  @override
  Widget build(BuildContext context) {
    final conversationsAsync = ref.watch(ownerConversationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('MESSAGES'),
        leading: BackButton(onPressed: () => context.go('/owner/today')),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: true, label: Text('Open')),
                ButtonSegment(value: false, label: Text('Closed')),
              ],
              selected: {_showOpen},
              onSelectionChanged: (s) => setState(() => _showOpen = s.first),
            ),
          ),
          Expanded(
            child: conversationsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    'Could not load messages.\n$e',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: AppColors.mutedText),
                  ),
                ),
              ),
              data: (conversations) {
                final filtered = conversations
                    .where((c) => c.isOpen == _showOpen)
                    .toList();
                if (filtered.isEmpty) {
                  return _Empty(showOpen: _showOpen);
                }
                return ListView.separated(
                  itemCount: filtered.length,
                  separatorBuilder: (_, _) =>
                      const Divider(height: 1, indent: 72),
                  itemBuilder: (context, i) =>
                      _ConversationTile(conversation: filtered[i]),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({required this.conversation});

  final OwnerConversation conversation;

  @override
  Widget build(BuildContext context) {
    final unread = conversation.ownerUnread;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      leading: const MascotFace(size: 44),
      title: Text(
        conversation.displayName,
        style: TextStyle(
          fontWeight: unread > 0 ? FontWeight.w800 : FontWeight.w600,
        ),
      ),
      subtitle: Text(
        conversation.lastMessagePreview ?? 'No messages yet',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: unread > 0 ? AppColors.onDark : AppColors.mutedText,
        ),
      ),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (conversation.lastMessageAt != null)
            Text(
              timeLabel(conversation.lastMessageAt!),
              style: const TextStyle(
                color: AppColors.mutedText,
                fontSize: 11,
              ),
            ),
          const SizedBox(height: 6),
          if (unread > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.emergency,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                '$unread',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
        ],
      ),
      onTap: () => context.go('/owner/chat/${conversation.id}'),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.showOpen});

  final bool showOpen;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Mascot(height: 110),
            const SizedBox(height: 16),
            Text(
              showOpen ? 'INBOX ZERO' : 'NO CLOSED CHATS',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(
              showOpen
                  ? 'New customer messages will show up here.'
                  : 'Closed conversations land here.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.mutedText),
            ),
          ],
        ),
      ),
    );
  }
}
