import 'package:freezed_annotation/freezed_annotation.dart';

part 'ap_invoice_models.freezed.dart';
part 'ap_invoice_models.g.dart';

@freezed
class ApInvoice with _$ApInvoice {
  const factory ApInvoice({
    required String id,
    required String docNo,
    required String docDate,
    required String dueDate,
    required String status,
    required String supplierId,
    required String supplierName,
    required String currencyCode,
    required double exchangeRate,
    required double subtotal,
    required double taxAmount,
    required double totalAmount,
    required double paidAmount,
    required double balanceDue,
    String? poId,
    String? poDocNo,
    String? paymentTerms,
    String? remarks,
    required List<ApInvoiceLine> lines,
  }) = _ApInvoice;

  factory ApInvoice.fromJson(Map<String, dynamic> json) =>
      _$ApInvoiceFromJson(json);
}

@freezed
class ApInvoiceLine with _$ApInvoiceLine {
  const factory ApInvoiceLine({
    required String id,
    required String description,
    required String glAccountCode,
    required String glAccountName,
    required double qty,
    required double unitPrice,
    required double taxPct,
    required double taxAmount,
    required double netAmount,
  }) = _ApInvoiceLine;

  factory ApInvoiceLine.fromJson(Map<String, dynamic> json) =>
      _$ApInvoiceLineFromJson(json);
}

@freezed
class ApInvoiceSummary with _$ApInvoiceSummary {
  const factory ApInvoiceSummary({
    required String id,
    required String docNo,
    required String docDate,
    required String dueDate,
    required String status,
    required String supplierName,
    required double totalAmount,
    required double balanceDue,
  }) = _ApInvoiceSummary;

  factory ApInvoiceSummary.fromJson(Map<String, dynamic> json) =>
      _$ApInvoiceSummaryFromJson(json);
}
