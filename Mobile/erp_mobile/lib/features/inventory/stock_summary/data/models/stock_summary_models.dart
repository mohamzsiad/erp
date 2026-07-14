import 'package:freezed_annotation/freezed_annotation.dart';

part 'stock_summary_models.freezed.dart';
part 'stock_summary_models.g.dart';

@freezed
class StockSummaryItem with _$StockSummaryItem {
  const factory StockSummaryItem({
    required String itemCode,
    required String itemDescription,
    required String categoryName,
    required String uomCode,
    required double onHandQty,
    required double reservedQty,
    required double availableQty,
    required double onOrderQty,
    required double unitCost,
    required double totalValue,
    String? warehouseName,
  }) = _StockSummaryItem;

  factory StockSummaryItem.fromJson(Map<String, dynamic> json) =>
      _$StockSummaryItemFromJson(json);
}

@freezed
class StockSummaryFilter with _$StockSummaryFilter {
  const factory StockSummaryFilter({
    @Default('') String search,
    @Default('') String warehouseId,
    @Default('') String categoryId,
    @Default(false) bool lowStockOnly,
  }) = _StockSummaryFilter;
}
