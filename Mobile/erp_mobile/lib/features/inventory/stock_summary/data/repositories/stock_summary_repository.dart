import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/api/api_client.dart';
import '../../../../../core/api/api_constants.dart';
import '../models/stock_summary_models.dart';

class StockSummaryRepository {
  StockSummaryRepository(this._dio);
  final dynamic _dio;

  Future<List<StockSummaryItem>> fetchSummary({
    String? search,
    String? warehouseId,
    String? categoryId,
    bool lowStockOnly = false,
  }) async {
    final resp = await _dio.get(
      ApiConstants.stockSummary,
      queryParameters: {
        if (search != null && search.isNotEmpty) 'search': search,
        if (warehouseId != null && warehouseId.isNotEmpty)
          'warehouseId': warehouseId,
        if (categoryId != null && categoryId.isNotEmpty)
          'categoryId': categoryId,
        if (lowStockOnly) 'lowStockOnly': true,
      },
    );
    final list = resp.data as List<dynamic>;
    return list
        .map((e) => StockSummaryItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

final stockSummaryRepositoryProvider = Provider<StockSummaryRepository>(
  (ref) => StockSummaryRepository(ref.read(apiClientProvider)),
);
