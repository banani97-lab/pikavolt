import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/models/api_models.dart';
import '../../core/models/db_models.dart';
import '../../core/supabase_provider.dart';

/// Active service categories (7 seeded from docs/owner-content.md).
final serviceCategoriesProvider =
    FutureProvider<List<ServiceCategory>>((ref) async {
  final client = ref.watch(supabaseClientProvider);
  final rows = await client
      .from('service_categories')
      .select()
      .eq('is_active', true)
      .order('sort_order', ascending: true);
  return (rows as List<dynamic>)
      .map((r) => ServiceCategory.fromJson(r as Map<String, dynamic>))
      .toList();
});

/// Active services for one category.
final servicesByCategoryProvider =
    FutureProvider.family<List<ServiceItem>, String>((ref, categoryId) async {
  final client = ref.watch(supabaseClientProvider);
  final rows = await client
      .from('services')
      .select()
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('sort_order', ascending: true);
  return (rows as List<dynamic>)
      .map((r) => ServiceItem.fromJson(r as Map<String, dynamic>))
      .toList();
});

/// Slots for one date (`YYYY-MM-DD`) from GET {API}/api/slots.
///
/// While WS-B's endpoint is still a 501 stub this surfaces an [ApiException];
/// the UI shows a retry state.
final slotsForDateProvider =
    FutureProvider.family<List<Slot>, String>((ref, date) async {
  final api = ref.watch(apiClientProvider);
  final response = await api.getSlots(date);
  return response.slots;
});
