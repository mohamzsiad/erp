import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/prl_models.dart';
import '../data/repositories/prl_repository.dart';

final prlStatusFilterProvider = StateProvider<String>((ref) => '');
final prlSearchProvider = StateProvider<String>((ref) => '');

class PrlListNotifier extends AsyncNotifier<List<PrlHeader>> {
  int _page = 1;
  bool _hasMore = true;
  final List<PrlHeader> _items = [];

  @override
  Future<List<PrlHeader>> build() async {
    _page = 1;
    _hasMore = true;
    _items.clear();
    final status = ref.watch(prlStatusFilterProvider);
    final search = ref.watch(prlSearchProvider);
    final res = await ref.read(prlRepositoryProvider).fetchList(
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
    final status = ref.read(prlStatusFilterProvider);
    final search = ref.read(prlSearchProvider);
    final res = await ref.read(prlRepositoryProvider).fetchList(
          page: _page,
          status: status,
          search: search,
        );
    _items.addAll(res.data);
    _hasMore = _items.length < res.total;
    state = AsyncData(List.from(_items));
  }
}

final prlListProvider =
    AsyncNotifierProvider<PrlListNotifier, List<PrlHeader>>(PrlListNotifier.new);

final prlDetailProvider =
    FutureProvider.autoDispose.family<PrlHeader, String>((ref, id) {
  return ref.read(prlRepositoryProvider).fetchById(id);
});

// Sub-section providers
final deliverySchedulesProvider =
    FutureProvider.autoDispose.family<List<DeliverySchedule>, ({String prlId, String lineId})>(
  (ref, args) =>
      ref.read(prlRepositoryProvider).fetchDeliverySchedules(args.prlId, args.lineId),
);

final accountDetailsProvider =
    FutureProvider.autoDispose.family<List<AccountDetail>, ({String prlId, String lineId})>(
  (ref, args) =>
      ref.read(prlRepositoryProvider).fetchAccountDetails(args.prlId, args.lineId),
);

final alternateItemsProvider =
    FutureProvider.autoDispose.family<List<AlternateItem>, ({String prlId, String lineId})>(
  (ref, args) =>
      ref.read(prlRepositoryProvider).fetchAlternateItems(args.prlId, args.lineId),
);

final itemStatusProvider =
    FutureProvider.autoDispose.family<ItemStatus, ({String prlId, String lineId})>(
  (ref, args) =>
      ref.read(prlRepositoryProvider).fetchItemStatus(args.prlId, args.lineId),
);

final shortCloseProvider =
    FutureProvider.autoDispose.family<ShortCloseInfo, ({String prlId, String lineId})>(
  (ref, args) =>
      ref.read(prlRepositoryProvider).fetchShortClose(args.prlId, args.lineId),
);

final leadTimeProvider =
    FutureProvider.autoDispose.family<LeadTimeInfo, ({String prlId, String lineId})>(
  (ref, args) =>
      ref.read(prlRepositoryProvider).fetchLeadTime(args.prlId, args.lineId),
);
