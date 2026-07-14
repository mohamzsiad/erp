import 'package:freezed_annotation/freezed_annotation.dart';

part 'po_models.freezed.dart';
part 'po_models.g.dart';

@freezed
class PoHeader with _$PoHeader {
  const factory PoHeader({
    required String id,
    required String companyId,
    required String docNo,
    required String docDate,
    String? deliveryDate,
    String? supplierId,
    @Default('') String supplierName,
    String? currencyId,
    @Default('OMR') String currencyCode,
    @Default(1.0) double exchangeRate,
    @Default(0.0) double totalAmount,
    String? paymentTerms,
    String? remarks,
    @Default('DRAFT') String status,
    @Default([]) List<PoLine> lines,
    String? createdAt,
    String? updatedAt,
  }) = _PoHeader;

  factory PoHeader.fromJson(Map<String, dynamic> json) =>
      _$PoHeaderFromJson(json);
}

@freezed
class PoLine with _$PoLine {
  const factory PoLine({
    required String id,
    String? itemId,
    @Default('') String itemCode,
    @Default('') String itemDescription,
    String? uomId,
    @Default('') String uomCode,
    @Default(0.0) double orderedQty,
    @Default(0.0) double receivedQty,
    @Default(0.0) double unitPrice,
    @Default(0.0) double discountPct,
    @Default(0.0) double taxPct,
    @Default(0.0) double netAmount,
    String? chargeCodeId,
    @Default('') String chargeCodeName,
    int? lineNo,
  }) = _PoLine;

  factory PoLine.fromJson(Map<String, dynamic> json) =>
      _$PoLineFromJson(json);
}
