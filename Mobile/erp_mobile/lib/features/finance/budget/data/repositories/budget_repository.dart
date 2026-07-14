import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/api/api_client.dart';
import '../../../../../core/api/api_constants.dart';
import '../models/budget_models.dart';

class BudgetRepository {
  BudgetRepository(this._dio);
  final dynamic _dio;

  Future<BudgetVsActual> fetchBudgetVsActual({
    required int year,
    String? categoryId,
  }) async {
    final resp = await _dio.get(
      ApiConstants.budgetVsActual,
      queryParameters: {
        'year': year,
        if (categoryId != null && categoryId.isNotEmpty)
          'categoryId': categoryId,
      },
    );
    return BudgetVsActual.fromJson(resp.data as Map<String, dynamic>);
  }
}

final budgetRepositoryProvider = Provider<BudgetRepository>(
  (ref) => BudgetRepository(ref.read(apiClientProvider)),
);
