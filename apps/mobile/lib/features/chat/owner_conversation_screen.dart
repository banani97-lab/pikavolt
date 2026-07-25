import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../core/models/db_models.dart';
import '../../core/theme.dart';
import '../../core/widgets/mascot.dart';
import '../booking/slot_utils.dart';
import '../owner/owner_chat_providers.dart';

/// Owner view of a single conversation (/owner/chat/:conversationId):
/// realtime thread, owner-role composer, marks read on open.
class OwnerConversationScreen extends ConsumerStatefulWidget {
  const OwnerConversationScreen({super.key, required this.conversationId});

  final String conversationId;

  @override
  ConsumerState<OwnerConversationScreen> createState() =>
      _OwnerConversationScreenState();
}

class _OwnerConversationScreenState
    extends ConsumerState<OwnerConversationScreen> {
  final _composer = TextEditingController();
  final _scrollController = ScrollController();
  bool _sending = false;
  int _lastCustomerCount = -1;

  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref
          .read(ownerChatRepositoryProvider)
          .markRead(widget.conversationId),
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
          .read(ownerChatRepositoryProvider)
          .sendMessage(widget.conversationId, body);
      _composer.clear();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Message not sent: $e')));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final messagesAsync =
        ref.watch(ownerConversationMessagesProvider(widget.conversationId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('CONVERSATION'),
        leading: BackButton(onPressed: () => context.go('/owner/chat')),
      ),
      body: Column(
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
                // Mark newly arrived customer messages read while open.
                final customerCount =
                    messages.where((m) => m.fromCustomer).length;
                if (customerCount != _lastCustomerCount) {
                  _lastCustomerCount = customerCount;
                  if (customerCount > 0) {
                    Future.microtask(() => ref
                        .read(ownerChatRepositoryProvider)
                        .markRead(widget.conversationId));
                  }
                }
                if (messages.isEmpty) {
                  return const Center(
                    child: Text(
                      'No messages yet.',
                      style: TextStyle(color: AppColors.mutedText),
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
                      decoration: const InputDecoration(
                        hintText: 'Reply to the customer…',
                      ),
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
                          : const Icon(Icons.send_rounded,
                              color: Colors.black),
                      onPressed: _sending ? null : _send,
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

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    // From the owner's perspective, the owner's own messages sit on the right.
    final mine = !message.fromCustomer;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment:
            mine ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!mine) ...[
            const CircleAvatar(
              radius: 14,
              backgroundColor: AppColors.teal,
              child: Icon(Icons.person, size: 16, color: AppColors.onDark),
            ),
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
          if (mine) ...[
            const SizedBox(width: 8),
            const MascotFace(size: 28),
          ],
        ],
      ),
    );
  }
}
