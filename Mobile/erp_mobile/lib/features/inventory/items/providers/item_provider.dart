import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/item_models.dart';
import '../data/repositories/item_repository.dart';

// ── Filters ───────────────────────────────────────────────────────────────────
final itemSearchProvider    = StateProvider<String>((ref) => '');
final itemCategoryProvider  = StateProvider<String>((ref) => '');
final itemTypeFilterProvider = StateProvider<String>((ref) => '');

// ── List (paginated) ──────────────────────────────────────────────────────────
class ItemListNotifier extends AsyncNotifier<List<ItemSummary>> {
  int _page = 1;
  bool _hasMore = true;
  static const _limit = 20;

  @override
  Future<List<ItemSummary>> build() async {
    _page = 1;
    _hasMore = true;
    ref.watch(itemSearchProvider);
    ref.watch(itemCategoryProvider);
    ref.watch(itemTypeFilterProvider);
    return _fetch(reset: true);
  }

  Future<List<ItemSummary>> _fetch({bool reset = false}) async {
    final result = await ref.read(itemRepositoryProvider).fetchList(
          page: _page,
          search: ref.read(itemSearchProvider),
          category: ref.read(itemCategoryProvider),
          itemType: ref.read(itemTypeFilterProvider),
        );
    _hasMore = result.data.length == _limit;
    if (reset) return result.data;
    return [...(state.value ?? []), ...result.data];
  }

  Future<void> loadMore() async {
    if (!_hasMore || state.isLoading) return;
    _page++;
    state = AsyncData(await _fetch());
  }
}

final itemListProvider =
    AsyncNotifierProvider<ItemListNotifier, List<ItemSummary>>(
        ItemListNotifier.new);

// ── Detail ────────────────────────────────────────────────────────────────────
final itemDetailProvider =
    FutureProvider.autoDispose.family<InventoryItem, String>(
  (ref, id) => ref.read(itemRepositoryProvider).fetchById(id),
);
