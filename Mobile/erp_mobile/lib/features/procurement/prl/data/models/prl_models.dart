import 'package:freezed_annotation/freezed_annotation.dart';

part 'prl_models.freezed.dart';
part 'prl_models.g.dart';

@freezed
class PrlHeader with _$PrlHeader {
  const factory PrlHeader({
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
    String? mrlNo,
    String? remarks,
    @Default('DRAFT') String status,
    @Default([]) List<PrlLine> lines,
    String? createdAt,
    String? updatedAt,
  }) = _PrlHeader;

  factory PrlHeader.fromJson(Map<String, dynamic> json) =>
      _$PrlHeaderFromJson(json);
}

@freezed
class PrlLine with _$PrlLine {
  const factory PrlLine({
    required String id,
    String? itemId,
    @Default('') String itemCode,
    @Default('') String itemDescription,
    String? grade1,
    String? grade2,
    String? uomId,
    @Default('') String uomCode,
    @Default(0.0) double requestedQty,
    double? approvedQty,
    @Default(0.0) double approxPrice,
    @Default(0.0) double freeStock,
    @Default('NONE') String shortCloseStatus,
    int? leadTimeDays,
    String? expectedDeliveryDate,
    int? lineNo,
  }) = _PrlLine;

  factory PrlLine.fromJson(Map<String, dynamic> json) =>
      _$PrlLineFromJson(json);
}

@freezed
class DeliverySchedule with _$DeliverySchedule {
  const factory DeliverySchedule({
    required String id,
    required String deliveryDate,
    required double qty,
    @Default('') String locationName,
    String? remarks,
  }) = _DeliverySchedule;

  factory DeliverySchedule.fromJson(Map<String, dynamic> json) =>
      _$DeliveryScheduleFromJson(json);
}

@freezed
class AccountDetail with _$AccountDetail {
  const factory AccountDetail({
    required String id,
    @Default('') String glAccountCode,
    @Default('') String glAccountName,
    String? costCentreName,
    @Default(0.0) double percentage,
    @Default(0.0) double amount,
    String? budgetYear,
  }) = _AccountDetail;

  factory AccountDetail.fromJson(Map<String, dynamic> json) =>
      _$AccountDetailFromJson(json);
}

@freezed
class AlternateItem with _$AlternateItem {
  const factory AlternateItem({
    required String id,
    @Default('') String itemCode,
    @Default('') String itemDescription,
    @Default(1) int priority,
    @Default(0.0) double approxPrice,
    @Default('') String uom,
    String? remarks,
  }) = _AlternateItem;

  factory AlternateItem.fromJson(Map<String, dynamic> json) =>
      _$AlternateItemFromJson(json);
}

@freezed
class ItemStatus with _$ItemStatus {
  const factory ItemStatus({
    @Default(0.0) double onHandQty,
    @Default(0.0) double reservedQty,
    @Default(0.0) double availableQty,
    @Default(0.0) double onOrderQty,
    @Default(0.0) double onPOQty,
  }) = _ItemStatus;

  factory ItemStatus.fromJson(Map<String, dynamic> json) =>
      _$ItemStatusFromJson(json);
}

@freezed
class ShortCloseInfo with _$ShortCloseInfo {
  const factory ShortCloseInfo({
    @Default('NONE') String shortCloseStatus,
    double? shortClosedQty,
    String? shortCloseReason,
    String? shortClosedAt,
  }) = _ShortCloseInfo;

  factory ShortCloseInfo.fromJson(Map<String, dynamic> json) =>
      _$ShortCloseInfoFromJson(json);
}

@freezed
class LeadTimeInfo with _$LeadTimeInfo {
  const factory LeadTimeInfo({
    int? leadTimeDays,
    String? expectedDeliveryDate,
    @Default('MANUAL') String leadTimeSource,
  }) = _LeadTimeInfo;

  factory LeadTimeInfo.fromJson(Map<String, dynamic> json) =>
      _$LeadTimeInfoFromJson(json);
}
