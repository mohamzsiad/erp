import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/ap_invoice_models.dart';
import '../data/repositories/ap_invoice_repository.dart';

final apInvoiceSearchProvider       = StateProvider<String>((ref) => '');
final apInvoiceStatusFilterProvider = StateProvider<String>((ref) => '');

class ApInvoiceListNotifier extends AsyncNotifier<List<ApInvoiceSummary>> {
  int _page = 1;
  bool _hasMore = true;
  static const _limit = 20;

  @override
  Future<List<ApInvoiceSummary>> build() async {
    _page = 1;
    _hasMore = true;
    ref.watch(apInvoiceSearchProvider);
    ref.watch(apInvoiceStatusFilterProvider);
    return _fetch(reset: true);
  }

  Future<List<ApInvoiceSummary>> _fetch({bool reset = false}) async {
    final result = await ref.read(apInvoiceRepositoryProvider).fetchList(
          page: _page,
          search: ref.read(apInvoiceSearchProvider),
          status: ref.read(apInvoiceStatusFilterProvider),
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

final apInvoiceListProvider =
    AsyncNotifierProvider<ApInvoiceListNotifier, List<ApInvoiceSummary>>(
        ApInvoiceListNotifier.new);

final apInvoiceDetailProvider =
    FutureProvider.autoDispose.family<ApInvoice, String>(
  (ref, id) => ref.read(apInvoiceRepositoryProvider).fetchById(id),
);
