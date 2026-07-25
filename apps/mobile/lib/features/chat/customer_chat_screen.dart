import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../core/models/db_models.dart';
import '../../core/theme.dart';
import '../../core/widgets/mascot.dart';
import '../booking/slot_utils.dart';
import 'chat_providers.dart';

/// Customer chat with Pikavolt (/customer/chat) — single realtime thread
/// with the owner. Owner avatar is the mascot face.
class CustomerChatScreen extends ConsumerWidget {
  const CustomerChatScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conversationAsync = ref.watch(myConversationProvider);

    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.go('/customer/home')),
        title: const Row(
          children: [
            MascotFace(size: 34, voltRing: true),
            SizedBox(width: 10),
            Text('PIKAVOLT'),
          ],
        ),
      ),
      body: conversationAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Could not open chat.\n$e',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.mutedText),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => ref.invalidate(myConversationProvider),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (conversation) => _ChatThread(conversationId: conversation.id),
      ),
    );
  }
}

class _ChatThread extends ConsumerStatefulWidget {
  const _ChatThread({required this.conversationId});

  final String conversationId;

  @override
  ConsumerState<_ChatThread> createState() => _ChatThreadState();
}

class _ChatThreadState extends ConsumerState<_ChatThread> {
  final _composer = TextEditingController();
  final _scrollController = ScrollController();
  bool _sending = false;
  int _lastOwnerMessageCount = -1;

  @override
  void initState() {
    super.initState();
    // Opening the thread clears the customer's unread counter.
    Future.microtask(
      () => ref.read(chatRepositoryProvider).markRead(widget.conversationId),
    );
  }

  @override
  void dispose() {
    _composer.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final body = _composer.text.trim();
    if (body.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await ref
          .read(chatRepositoryProvider)
          .sendMessage(widget.conversationId, body);
      _composer.clear();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Message not sent: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController
            .jumpTo(_scrollController.position.maxScrollExtent);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final messagesAsync =
        ref.watch(conversationMessagesProvider(widget.conversationId));

    return Column(
      children: [
        Expanded(
          child: messagesAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(
              child: Text(
                'Could not load messages.\n$e',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.mutedText),
              ),
            ),
            data: (messages) {
              _scrollToBottom();
              // Mark newly arriving owner messages as read while the thread
              // is open.
              final ownerCount =
                  messages.where((m) => !m.fromCustomer).length;
              if (ownerCount != _lastOwnerMessageCount) {
                _lastOwnerMessageCount = ownerCount;
                if (ownerCount > 0) {
                  Future.microtask(() => ref
                      .read(chatRepositoryProvider)
                      .markRead(widget.conversationId));
                }
              }
              if (messages.isEmpty) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Mascot(height: 120),
                        const SizedBox(height: 16),
                        Text(
                          'SAY HELLO!',
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Questions about a job, a quote, or anything '
                          'electrical — we answer fast.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: AppColors.mutedText),
                        ),
                      ],
                    ),
                  ),
                );
              }
              return ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.all(16),
                itemCount: messages.length,
                itemBuilder: (context, i) =>
                    _MessageBubble(message: messages[i]),
              );
            },
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _composer,
                    textCapitalization: TextCapitalization.sentences,
                    minLines: 1,
                    maxLines: 4,
                    decoration:
                        const InputDecoration(hintText: 'Message Pikavolt…'),
                    onSubmitted: (_) => _send(),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  decoration: const BoxDecoration(
                    color: AppColors.voltYellow,
                    shape: BoxShape.circle,
                  ),
                  child: IconButton(
                    icon: _sending
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.black,
                            ),
                          )
                        : const Icon(Icons.send_rounded, color: Colors.black),
                    onPressed: _sending ? null : _send,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final mine = message.fromCustomer;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment:
            mine ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!mine) ...[
            const MascotFace(size: 28),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              constraints: const BoxConstraints(maxWidth: 300),
              decoration: BoxDecoration(
                color: mine ? AppColors.teal : AppColors.surface,
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(16),
                  topRight: const Radius.circular(16),
                  bottomLeft: Radius.circular(mine ? 16 : 4),
                  bottomRight: Radius.circular(mine ? 4 : 16),
                ),
                border: Border.all(
                  color: mine ? AppColors.teal : AppColors.outline,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(message.body),
                  const SizedBox(height: 2),
                  Text(
                    timeLabel(message.createdAt),
                    style: const TextStyle(
                      fontSize: 10,
                      color: AppColors.mutedText,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
