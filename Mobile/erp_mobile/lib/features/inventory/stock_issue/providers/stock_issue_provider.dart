import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/stock_issue_models.dart';
import '../data/repositories/stock_issue_repository.dart';

final stockIssueSearchProvider       = StateProvider<String>((ref) => '');
final stockIssueStatusFilterProvider = StateProvider<String>((ref) => '');

class StockIssueListNotifier extends AsyncNotifier<List<StockIssueSummary>> {
  int _page = 1;
  bool _hasMore = true;
  static const _limit = 20;

  @override
  Future<List<StockIssueSummary>> build() async {
    _page = 1;
    _hasMore = true;
    ref.watch(stockIssueSearchProvider);
    ref.watch(stockIssueStatusFilterProvider);
    return _fetch(reset: true);
  }

  Future<List<StockIssueSummary>> _fetch({bool reset = false}) async {
    final result = await ref.read(stockIssueRepositoryProvider).fetchList(
          page: _page,
          search: ref.read(stockIssueSearchProvider),
          status: ref.read(stockIssueStatusFilterProvider),
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

final stockIssueListProvider =
    AsyncNotifierProvider<StockIssueListNotifier, List<StockIssueSummary>>(
        StockIssueListNotifier.new);

final stockIssueDetailProvider =
    FutureProvider.autoDispose.family<StockIssueHeader, String>(
  (ref, id) => ref.read(stockIssueRepositoryProvider).fetchById(id),
);
