import 'package:freezed_annotation/freezed_annotation.dart';

part 'ar_invoice_models.freezed.dart';
part 'ar_invoice_models.g.dart';

@freezed
class ArInvoice with _$ArInvoice {
  const factory ArInvoice({
    required String id,
    required String docNo,
    required String docDate,
    required String dueDate,
    required String status,
    required String customerId,
    required String customerName,
    required String currencyCode,
    required double exchangeRate,
    required double subtotal,
    required double taxAmount,
    required double totalAmount,
    required double receivedAmount,
    required double balanceDue,
    String? projectId,
    String? projectName,
    String? paymentTerms,
    String? remarks,
    required List<ArInvoiceLine> lines,
  }) = _ArInvoice;

  factory ArInvoice.fromJson(Map<String, dynamic> json) =>
      _$ArInvoiceFromJson(json);
}

@freezed
class ArInvoiceLine with _$ArInvoiceLine {
  const factory ArInvoiceLine({
    required String id,
    required String description,
    required String glAccountCode,
    required String glAccountName,
    required double qty,
    required double unitPrice,
    required double taxPct,
    required double taxAmount,
    required double netAmount,
  }) = _ArInvoiceLine;

  factory ArInvoiceLine.fromJson(Map<String, dynamic> json) =>
      _$ArInvoiceLineFromJson(json);
}

@freezed
class ArInvoiceSummary with _$ArInvoiceSummary {
  const factory ArInvoiceSummary({
    required String id,
    required String docNo,
    required String docDate,
    required String dueDate,
    required String status,
    required String customerName,
    required double totalAmount,
    required double balanceDue,
  }) = _ArInvoiceSummary;

  factory ArInvoiceSummary.fromJson(Map<String, dynamic> json) =>
      _$ArInvoiceSummaryFromJson(json);
}
