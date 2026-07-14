import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/budget_models.dart';
import '../data/repositories/budget_repository.dart';

final budgetYearProvider =
    StateProvider<int>((ref) => DateTime.now().year);
final budgetCategoryFilterProvider = StateProvider<String>((ref) => '');
final budgetSelectedCategoryProvider = StateProvider<int?>((ref) => null);

final budgetVsActualProvider =
    FutureProvider.autoDispose<BudgetVsActual>((ref) {
  final year = ref.watch(budgetYearProvider);
  final cat  = ref.watch(budgetCategoryFilterProvider);
  return ref
      .read(budgetRepositoryProvider)
      .fetchBudgetVsActual(year: year, categoryId: cat.isEmpty ? null : cat);
});
