import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/journal_entry_models.dart';
import '../data/repositories/journal_entry_repository.dart';

final jeSearchProvider       = StateProvider<String>((ref) => '');
final jeStatusFilterProvider = StateProvider<String>((ref) => '');

class JournalEntryListNotifier
    extends AsyncNotifier<List<JournalEntrySummary>> {
  int _page = 1; bool _hasMore = true;
  static const _limit = 20;

  @override
  Future<List<JournalEntrySummary>> build() async {
    _page = 1; _hasMore = true;
    ref.watch(jeSearchProvider);
    ref.watch(jeStatusFilterProvider);
    return _fetch(reset: true);
  }

  Future<List<JournalEntrySummary>> _fetch({bool reset = false}) async {
    final result = await ref.read(journalEntryRepositoryProvider).fetchList(
          page: _page,
          search: ref.read(jeSearchProvider),
          status: ref.read(jeStatusFilterProvider),
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

final journalEntryListProvider =
    AsyncNotifierProvider<JournalEntryListNotifier, List<JournalEntrySummary>>(
        JournalEntryListNotifier.new);

final journalEntryDetailProvider =
    FutureProvider.autoDispose.family<JournalEntry, String>(
  (ref, id) => ref.read(journalEntryRepositoryProvider).fetchById(id),
);
