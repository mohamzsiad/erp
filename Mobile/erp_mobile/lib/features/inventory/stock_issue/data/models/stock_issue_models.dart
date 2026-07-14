import 'package:freezed_annotation/freezed_annotation.dart';

part 'stock_issue_models.freezed.dart';
part 'stock_issue_models.g.dart';

@freezed
class StockIssueHeader with _$StockIssueHeader {
  const factory StockIssueHeader({
    required String id,
    required String docNo,
    required String docDate,
    required String status,
    required String warehouseId,
    required String warehouseName,
    required String issuedToId,
    required String issuedToName,
    required String issueType,
    String? projectId,
    String? projectName,
    String? chargeCodeId,
    String? chargeCodeName,
    String? remarks,
    required List<StockIssueLine> lines,
  }) = _StockIssueHeader;

  factory StockIssueHeader.fromJson(Map<String, dynamic> json) =>
      _$StockIssueHeaderFromJson(json);
}

@freezed
class StockIssueLine with _$StockIssueLine {
  const factory StockIssueLine({
    required String id,
    required String itemCode,
    required String itemDescription,
    required String uomCode,
    required double requestedQty,
    required double issuedQty,
    required double unitCost,
    required double totalCost,
    String? lotNo,
    String? remarks,
  }) = _StockIssueLine;

  factory StockIssueLine.fromJson(Map<String, dynamic> json) =>
      _$StockIssueLineFromJson(json);
}

@freezed
class StockIssueSummary with _$StockIssueSummary {
  const factory StockIssueSummary({
    required String id,
    required String docNo,
    required String docDate,
    required String status,
    required String warehouseName,
    required String issuedToName,
    required String issueType,
  }) = _StockIssueSummary;

  factory StockIssueSummary.fromJson(Map<String, dynamic> json) =>
      _$StockIssueSummaryFromJson(json);
}
