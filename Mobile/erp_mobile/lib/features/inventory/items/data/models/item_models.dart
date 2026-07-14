import 'package:freezed_annotation/freezed_annotation.dart';

part 'item_models.freezed.dart';
part 'item_models.g.dart';

@freezed
class InventoryItem with _$InventoryItem {
  const factory InventoryItem({
    required String id,
    required String itemCode,
    required String itemDescription,
    required String categoryId,
    required String categoryName,
    required String uomCode,
    required String itemType,
    required bool isActive,
    required double standardCost,
    required double currentCost,
    required double onHandQty,
    required double reservedQty,
    required double availableQty,
    required double onOrderQty,
    String? barcode,
    String? manufacturer,
    String? manufacturerPartNo,
    String? remarks,
    double? minStockLevel,
    double? maxStockLevel,
    double? reorderPoint,
    double? reorderQty,
  }) = _InventoryItem;

  factory InventoryItem.fromJson(Map<String, dynamic> json) =>
      _$InventoryItemFromJson(json);
}

@freezed
class ItemSummary with _$ItemSummary {
  const factory ItemSummary({
    required String id,
    required String itemCode,
    required String itemDescription,
    required String categoryName,
    required String uomCode,
    required double onHandQty,
    required double availableQty,
    required double standardCost,
    required bool isActive,
  }) = _ItemSummary;

  factory ItemSummary.fromJson(Map<String, dynamic> json) =>
      _$ItemSummaryFromJson(json);
}
