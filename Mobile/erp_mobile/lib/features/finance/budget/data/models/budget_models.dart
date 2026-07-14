import 'package:freezed_annotation/freezed_annotation.dart';

part 'budget_models.freezed.dart';
part 'budget_models.g.dart';

@freezed
class BudgetVsActual with _$BudgetVsActual {
  const factory BudgetVsActual({
    required String period,
    required List<BudgetCategory> categories,
    required double totalBudget,
    required double totalActual,
    required double totalVariance,
  }) = _BudgetVsActual;

  factory BudgetVsActual.fromJson(Map<String, dynamic> json) =>
      _$BudgetVsActualFromJson(json);
}

@freezed
class BudgetCategory with _$BudgetCategory {
  const factory BudgetCategory({
    required String categoryId,
    required String categoryName,
    required double budgetAmount,
    required double actualAmount,
    required double variance,
    required double variancePct,
    required List<BudgetMonthly> monthly,
  }) = _BudgetCategory;

  factory BudgetCategory.fromJson(Map<String, dynamic> json) =>
      _$BudgetCategoryFromJson(json);
}

@freezed
class BudgetMonthly with _$BudgetMonthly {
  const factory BudgetMonthly({
    required int month,
    required String monthName,
    required double budgetAmount,
    required double actualAmount,
    required double variance,
  }) = _BudgetMonthly;

  factory BudgetMonthly.fromJson(Map<String, dynamic> json) =>
      _$BudgetMonthlyFromJson(json);
}
