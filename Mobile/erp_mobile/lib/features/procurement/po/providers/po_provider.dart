import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/po_models.dart';
import '../data/repositories/po_repository.dart';

final poStatusFilterProvider = StateProvider<String>((ref) => '');
final poSearchProvider = StateProvider<String>((ref) => '');

class PoListNotifier extends AsyncNotifier<List<PoHeader>> {
  int _page = 1;
  bool _hasMore = true;
  final List<PoHeader> _items = [];

  @override
  Future<List<PoHeader>> build() async {
    _page = 1;
    _hasMore = true;
    _items.clear();
    final status = ref.watch(poStatusFilterProvider);
    final search = ref.watch(poSearchProvider);
    final res = await ref.read(poRepositoryProvider).fetchList(
          status: status,
          search: search,
        );
    _items.addAll(res.data);
    _hasMore = _items.length < res.total;
    return List.from(_items);
  }

  Future<void> loadMore() async {
    if (!_hasMore) return;
    _page++;
    final status = ref.read(poStatusFilterProvider);
    final search = ref.read(poSearchProvider);
    final res = await ref.read(poRepositoryProvider).fetchList(
          page: _page,
          status: status,
          search: search,
        );
    _items.addAll(res.data);
    _hasMore = _items.length < res.total;
    state = AsyncData(List.from(_items));
  }
}

final poListProvider =
    AsyncNotifierProvider<PoListNotifier, List<PoHeader>>(PoListNotifier.new);

final poDetailProvider =
    FutureProvider.autoDispose.family<PoHeader, String>((ref, id) {
  return ref.read(poRepositoryProvider).fetchById(id);
});
