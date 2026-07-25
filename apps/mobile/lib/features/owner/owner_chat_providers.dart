/// Owner-side chat providers. Mirrors features/chat/chat_providers.dart but
/// from the owner's perspective (all conversations, owner-role sends,
/// owner-role read receipts).
library;

import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../core/models/db_models.dart';
import '../../core/supabase_provider.dart';

/// A conversation row with the extra fields the owner inbox needs
/// (previews, owner_unread, visitor/customer name).
class OwnerConversation {
  const OwnerConversation({
    required this.id,
    required this.customerId,
    required this.status,
    this.visitorName,
    this.lastMessagePreview,
    this.lastMessageAt,
    this.ownerUnread = 0,
    this.customerName,
  });

  final String id;
  final String customerId;
  final String status;
  final String? visitorName;
  final String? lastMessagePreview;
  final DateTime? lastMessageAt;
  final int ownerUnread;

  /// Joined from profiles (populated by [ownerConversationsProvider]).
  final String? customerName;

  bool get isOpen => status == 'open';

  /// Best display name: visitor name, else the customer's profile name.
  String get displayName {
    if (visitorName != null && visitorName!.trim().isNotEmpty) {
      return visitorName!;
    }
    if (customerName != null && customerName!.trim().isNotEmpty) {
      return customerName!;
    }
    return 'Customer';
  }

  OwnerConversation withCustomerName(String? name) => OwnerConversation(
        id: id,
        customerId: customerId,
        status: status,
        visitorName: visitorName,
        lastMessagePreview: lastMessagePreview,
        lastMessageAt: lastMessageAt,
        ownerUnread: ownerUnread,
        customerName: name,
      );

  factory OwnerConversation.fromJson(Map<String, dynamic> json) =>
      OwnerConversation(
        id: json['id'] as String,
        customerId: json['customer_id'] as String,
        status: json['status'] as String? ?? 'open',
        visitorName: json['visitor_name'] as String?,
        lastMessagePreview: json['last_message_preview'] as String?,
        lastMessageAt: json['last_message_at'] == null
            ? null
            : DateTime.parse(json['last_message_at'] as String).toLocal(),
        ownerUnread: (json['owner_unread'] as num?)?.toInt() ?? 0,
      );
}

/// Realtime stream of all conversations (owner RLS), most-recent first, with
/// customer profile names joined in.
final ownerConversationsProvider =
    StreamProvider<List<OwnerConversation>>((ref) {
  final client = ref.watch(supabaseClientProvider);
  return client
      .from('conversations')
      .stream(primaryKey: ['id'])
      .order('last_message_at', ascending: false)
      .asyncMap((rows) async {
        final conversations = rows.map(OwnerConversation.fromJson).toList();
        if (conversations.isEmpty) return conversations;
        final ids =
            conversations.map((c) => c.customerId).toSet().toList();
        final profiles = await client
            .from('profiles')
            .select('id, full_name')
            .inFilter('id', ids);
        final names = {
          for (final p in profiles as List)
            (p as Map)['id'] as String: p['full_name'] as String?,
        };
        return [
          for (final c in conversations)
            c.withCustomerName(names[c.customerId]),
        ];
      });
});

/// Total unread messages across all conversations (for the Today-screen
/// badge). Falls back to 0 while loading.
final ownerUnreadCountProvider = Provider<int>((ref) {
  final conversations = ref.watch(ownerConversationsProvider).value ?? [];
  return conversations.fold(0, (sum, c) => sum + c.ownerUnread);
});

/// Realtime message thread (shared shape with the customer side).
final ownerConversationMessagesProvider =
    StreamProvider.family<List<ChatMessage>, String>((ref, conversationId) {
  final client = ref.watch(supabaseClientProvider);
  return client
      .from('messages')
      .stream(primaryKey: ['id'])
      .eq('conversation_id', conversationId)
      .order('created_at', ascending: true)
      .map((rows) => rows.map(ChatMessage.fromJson).toList());
});

/// Owner chat actions: send as owner + mark-read as owner.
class OwnerChatRepository {
  const OwnerChatRepository(this._ref);

  final Ref _ref;

  Future<void> sendMessage(String conversationId, String body) async {
    final client = _ref.read(supabaseClientProvider);
    final userId = client.auth.currentUser!.id;
    await client.from('messages').insert({
      'conversation_id': conversationId,
      'sender_id': userId,
      'sender_role': 'owner',
      'body': body,
    });
  }

  Future<void> markRead(String conversationId) async {
    final client = _ref.read(supabaseClientProvider);
    await client.rpc('mark_conversation_read', params: {
      'p_conversation_id': conversationId,
      'p_role': 'owner',
    });
  }

  Future<void> setStatus(String conversationId, String status) async {
    final client = _ref.read(supabaseClientProvider);
    await client
        .from('conversations')
        .update({'status': status}).eq('id', conversationId);
  }
}

final ownerChatRepositoryProvider =
    Provider<OwnerChatRepository>((ref) => OwnerChatRepository(ref));
