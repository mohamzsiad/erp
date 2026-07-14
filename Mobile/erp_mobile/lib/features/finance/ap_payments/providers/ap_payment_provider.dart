import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/ap_payment_models.dart';
import '../data/repositories/ap_payment_repository.dart';

final apPaymentSearchProvider       = StateProvider<String>((ref) => '');
final apPaymentStatusFilterProvider = StateProvider<String>((ref) => '');

class ApPaymentListNotifier extends AsyncNotifier<List<ApPaymentSummary>> {
  int _page = 1;
  bool _hasMore = true;
  static const _limit = 20;

  @override
  Future<List<ApPaymentSummary>> build() async {
    _page = 1; _hasMore = true;
    ref.watch(apPaymentSearchProvider);
    ref.watch(apPaymentStatusFilterProvider);
    return _fetch(reset: true);
  }

  Future<List<ApPaymentSummary>> _fetch({bool reset = false}) async {
    final result = await ref.read(apPaymentRepositoryProvider).fetchList(
          page: _page,
          search: ref.read(apPaymentSearchProvider),
          status: ref.read(apPaymentStatusFilterProvider),
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

final apPaymentListProvider =
    AsyncNotifierProvider<ApPaymentListNotifier, List<ApPaymentSummary>>(
        ApPaymentListNotifier.new);

final apPaymentDetailProvider =
    FutureProvider.autoDispose.family<ApPayment, String>(
  (ref, id) => ref.read(apPaymentRepositoryProvider).fetchById(id),
);
