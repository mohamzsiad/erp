import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/mrl_models.dart';
import '../data/repositories/mrl_repository.dart';

final mrlStatusFilterProvider = StateProvider<String>((ref) => '');
final mrlSearchProvider = StateProvider<String>((ref) => '');

class MrlListNotifier extends AsyncNotifier<List<MrlHeader>> {
  int _page = 1;
  bool _hasMore = true;
  final List<MrlHeader> _items = [];

  @override
  Future<List<MrlHeader>> build() async {
    _page = 1;
    _hasMore = true;
    _items.clear();
    final status = ref.watch(mrlStatusFilterProvider);
    final search = ref.watch(mrlSearchProvider);
    final res = await ref.read(mrlRepositoryProvider).fetchList(
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
    final status = ref.read(mrlStatusFilterProvider);
    final search = ref.read(mrlSearchProvider);
    final res = await ref.read(mrlRepositoryProvider).fetchList(
          page: _page,
          status: status,
          search: search,
        );
    _items.addAll(res.data);
    _hasMore = _items.length < res.total;
    state = AsyncData(List.from(_items));
  }
}

final mrlListProvider =
    AsyncNotifierProvider<MrlListNotifier, List<MrlHeader>>(MrlListNotifier.new);

final mrlDetailProvider =
    FutureProvider.autoDispose.family<MrlHeader, String>((ref, id) {
  return ref.read(mrlRepositoryProvider).fetchById(id);
});
