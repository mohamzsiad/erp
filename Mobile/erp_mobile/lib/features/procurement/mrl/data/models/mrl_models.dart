import 'package:freezed_annotation/freezed_annotation.dart';

part 'mrl_models.freezed.dart';
part 'mrl_models.g.dart';

@freezed
class MrlHeader with _$MrlHeader {
  const factory MrlHeader({
    required String id,
    required String companyId,
    required String docNo,
    required String docDate,
    String? deliveryDate,
    String? locationId,
    String? locationName,
    String? chargeCodeId,
    String? chargeCodeName,
    String? mrlId,
    String? remarks,
    @Default('DRAFT') String status,
    @Default([]) List<MrlLine> lines,
    String? createdAt,
    String? updatedAt,
  }) = _MrlHeader;

  factory MrlHeader.fromJson(Map<String, dynamic> json) =>
      _$MrlHeaderFromJson(json);
}

@freezed
class MrlLine with _$MrlLine {
  const factory MrlLine({
    required String id,
    String? itemId,
    @Default('') String itemCode,
    @Default('') String itemDescription,
    String? uomId,
    @Default('') String uomCode,
    @Default(0.0) double requestedQty,
    double? approvedQty,
    @Default(0.0) double approxPrice,
    @Default(0.0) double freeStock,
    int? lineNo,
  }) = _MrlLine;

  factory MrlLine.fromJson(Map<String, dynamic> json) =>
      _$MrlLineFromJson(json);
}
