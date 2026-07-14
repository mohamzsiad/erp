import 'package:freezed_annotation/freezed_annotation.dart';

part 'grn_models.freezed.dart';
part 'grn_models.g.dart';

@freezed
class GrnHeader with _$GrnHeader {
  const factory GrnHeader({
    required String id,
    required String docNo,
    required String docDate,
    required String status,
    required String supplierId,
    required String supplierName,
    required String warehouseId,
    required String warehouseName,
    required double totalAmount,
    String? poId,
    String? poDocNo,
    String? deliveryNoteNo,
    String? remarks,
    required List<GrnLine> lines,
  }) = _GrnHeader;

  factory GrnHeader.fromJson(Map<String, dynamic> json) =>
      _$GrnHeaderFromJson(json);
}

@freezed
class GrnLine with _$GrnLine {
  const factory GrnLine({
    required String id,
    required String itemCode,
    required String itemDescription,
    required String uomCode,
    required double orderedQty,
    required double receivedQty,
    required double acceptedQty,
    required double rejectedQty,
    required double unitPrice,
    required double netAmount,
    String? poLineId,
    String? lotNo,
    String? serialNo,
    String? expiryDate,
    String? remarks,
  }) = _GrnLine;

  factory GrnLine.fromJson(Map<String, dynamic> json) =>
      _$GrnLineFromJson(json);
}

@freezed
class GrnSummary with _$GrnSummary {
  const factory GrnSummary({
    required String id,
    required String docNo,
    required String docDate,
    required String status,
    required String supplierName,
    required double totalAmount,
    String? poDocNo,
  }) = _GrnSummary;

  factory GrnSummary.fromJson(Map<String, dynamic> json) =>
      _$GrnSummaryFromJson(json);
}
