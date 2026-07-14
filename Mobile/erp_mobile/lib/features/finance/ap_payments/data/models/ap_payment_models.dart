import 'package:freezed_annotation/freezed_annotation.dart';

part 'ap_payment_models.freezed.dart';
part 'ap_payment_models.g.dart';

@freezed
class ApPayment with _$ApPayment {
  const factory ApPayment({
    required String id,
    required String docNo,
    required String docDate,
    required String status,
    required String supplierId,
    required String supplierName,
    required String paymentMethod,
    required String currencyCode,
    required double exchangeRate,
    required double amount,
    String? bankAccountId,
    String? bankAccountName,
    String? chequeNo,
    String? chequeDate,
    String? remarks,
    required List<ApPaymentAllocation> allocations,
  }) = _ApPayment;

  factory ApPayment.fromJson(Map<String, dynamic> json) =>
      _$ApPaymentFromJson(json);
}

@freezed
class ApPaymentAllocation with _$ApPaymentAllocation {
  const factory ApPaymentAllocation({
    required String invoiceId,
    required String invoiceDocNo,
    required String invoiceDate,
    required double invoiceAmount,
    required double allocatedAmount,
    required double balanceAfter,
  }) = _ApPaymentAllocation;

  factory ApPaymentAllocation.fromJson(Map<String, dynamic> json) =>
      _$ApPaymentAllocationFromJson(json);
}

@freezed
class ApPaymentSummary with _$ApPaymentSummary {
  const factory ApPaymentSummary({
    required String id,
    required String docNo,
    required String docDate,
    required String status,
    required String supplierName,
    required String paymentMethod,
    required double amount,
  }) = _ApPaymentSummary;

  factory ApPaymentSummary.fromJson(Map<String, dynamic> json) =>
      _$ApPaymentSummaryFromJson(json);
}
