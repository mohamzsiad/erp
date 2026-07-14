import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/ar_invoice_models.dart';
import '../data/repositories/ar_invoice_repository.dart';

final arInvoiceSearchProvider       = StateProvider<String>((ref) => '');
final arInvoiceStatusFilterProvider = StateProvider<String>((ref) => '');

class ArInvoiceListNotifier extends AsyncNotifier<List<ArInvoiceSummary>> {
  int _page = 1; bool _hasMore = true;
  static const _limit = 20;

  @override
  Future<List<ArInvoiceSummary>> build() async {
    _page = 1; _hasMore = true;
    ref.watch(arInvoiceSearchProvider);
    ref.watch(arInvoiceStatusFilterProvider);
    return _fetch(reset: true);
  }

  Future<List<ArInvoiceSummary>> _fetch({bool reset = false}) async {
    final result = await ref.read(arInvoiceRepositoryProvider).fetchList(
          page: _page,
          search: ref.read(arInvoiceSearchProvider),
          status: ref.read(arInvoiceStatusFilterProvider),
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

final arInvoiceListProvider =
    AsyncNotifierProvider<ArInvoiceListNotifier, List<ArInvoiceSummary>>(
        ArInvoiceListNotifier.new);

final arInvoiceDetailProvider =
    FutureProvider.autoDispose.family<ArInvoice, String>(
  (ref, id) => ref.read(arInvoiceRepositoryProvider).fetchById(id),
);
