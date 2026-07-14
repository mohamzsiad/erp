import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/grn_models.dart';
import '../data/repositories/grn_repository.dart';

final grnSearchProvider       = StateProvider<String>((ref) => '');
final grnStatusFilterProvider = StateProvider<String>((ref) => '');

class GrnListNotifier extends AsyncNotifier<List<GrnSummary>> {
  int _page = 1;
  bool _hasMore = true;
  static const _limit = 20;

  @override
  Future<List<GrnSummary>> build() async {
    _page = 1;
    _hasMore = true;
    ref.watch(grnSearchProvider);
    ref.watch(grnStatusFilterProvider);
    return _fetch(reset: true);
  }

  Future<List<GrnSummary>> _fetch({bool reset = false}) async {
    final result = await ref.read(grnRepositoryProvider).fetchList(
          page: _page,
          search: ref.read(grnSearchProvider),
          status: ref.read(grnStatusFilterProvider),
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

final grnListProvider =
    AsyncNotifierProvider<GrnListNotifier, List<GrnSummary>>(
        GrnListNotifier.new);

final grnDetailProvider =
    FutureProvider.autoDispose.family<GrnHeader, String>(
  (ref, id) => ref.read(grnRepositoryProvider).fetchById(id),
);
