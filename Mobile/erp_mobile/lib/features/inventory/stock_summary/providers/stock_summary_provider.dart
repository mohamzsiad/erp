import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/stock_summary_models.dart';
import '../data/repositories/stock_summary_repository.dart';

final stockSummaryFilterProvider =
    StateProvider<StockSummaryFilter>((ref) => const StockSummaryFilter());

final stockSummaryProvider =
    FutureProvider.autoDispose<List<StockSummaryItem>>((ref) {
  final f = ref.watch(stockSummaryFilterProvider);
  return ref.read(stockSummaryRepositoryProvider).fetchSummary(
        search: f.search,
        warehouseId: f.warehouseId,
        categoryId: f.categoryId,
        lowStockOnly: f.lowStockOnly,
      );
});
