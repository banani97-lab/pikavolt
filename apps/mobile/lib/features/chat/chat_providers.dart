import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../core/models/db_models.dart';
import '../../core/supabase_provider.dart';

/// Finds the customer's open conversation, creating one if none exists.
final myConversationProvider = FutureProvider<Conversation>((ref) async {
  final client = ref.watch(supabaseClientProvider);
  final user = ref.watch(currentUserProvider);
  if (user == null) throw StateError('not signed in');

  final existing = await client
      .from('conversations')
      .select()
      .eq('customer_id', user.id)
      .eq('status', 'open')
      .order('created_at', ascending: false)
      .limit(1)
      .maybeSingle();
  if (existing != null) return Conversation.fromJson(existing);

  final created = await client
      .from('conversations')
      .insert({'customer_id': user.id})
      .select()
      .single();
  return Conversation.fromJson(created);
});

/// Realtime message stream for a conversation (Supabase `.stream` — realtime
/// postgres_changes under the hood; INSERTs appear immediately).
final conversationMessagesProvider =
    StreamProvider.family<List<ChatMessage>, String>((ref, conversationId) {
  final client = ref.watch(supabaseClientProvider);
  return client
      .from('messages')
      .stream(primaryKey: ['id'])
      .eq('conversation_id', conversationId)
      .order('created_at', ascending: true)
      .map((rows) => rows.map(ChatMessage.fromJson).toList());
});

/// Chat actions: send + mark-read.
class ChatRepository {
  const ChatRepository(this._ref);

  final Ref _ref;

  Future<void> sendMessage(String conversationId, String body) async {
    final client = _ref.read(supabaseClientProvider);
    final userId = client.auth.currentUser!.id;
    await client.from('messages').insert({
      'conversation_id': conversationId,
      'sender_id': userId,
      'sender_role': 'customer',
      'body': body,
    });
  }

  /// Clears the customer's unread counter (RPC enforces authorization).
  Future<void> markRead(String conversationId) async {
    final client = _ref.read(supabaseClientProvider);
    await client.rpc('mark_conversation_read', params: {
      'p_conversation_id': conversationId,
      'p_role': 'customer',
    });
  }
}

final chatRepositoryProvider =
    Provider<ChatRepository>((ref) => ChatRepository(ref));
