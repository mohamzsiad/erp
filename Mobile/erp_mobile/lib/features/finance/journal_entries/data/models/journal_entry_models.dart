import 'package:freezed_annotation/freezed_annotation.dart';

part 'journal_entry_models.freezed.dart';
part 'journal_entry_models.g.dart';

@freezed
class JournalEntry with _$JournalEntry {
  const factory JournalEntry({
    required String id,
    required String docNo,
    required String docDate,
    required String status,
    required String description,
    required String journalType,
    required double totalDebit,
    required double totalCredit,
    required String currencyCode,
    required double exchangeRate,
    String? reference,
    String? remarks,
    required List<JournalLine> lines,
  }) = _JournalEntry;

  factory JournalEntry.fromJson(Map<String, dynamic> json) =>
      _$JournalEntryFromJson(json);
}

@freezed
class JournalLine with _$JournalLine {
  const factory JournalLine({
    required String id,
    required String glAccountCode,
    required String glAccountName,
    required double debitAmount,
    required double creditAmount,
    String? costCentreCode,
    String? costCentreName,
    String? description,
    String? reference,
  }) = _JournalLine;

  factory JournalLine.fromJson(Map<String, dynamic> json) =>
      _$JournalLineFromJson(json);
}

@freezed
class JournalEntrySummary with _$JournalEntrySummary {
  const factory JournalEntrySummary({
    required String id,
    required String docNo,
    required String docDate,
    required String status,
    required String description,
    required String journalType,
    required double totalDebit,
  }) = _JournalEntrySummary;

  factory JournalEntrySummary.fromJson(Map<String, dynamic> json) =>
      _$JournalEntrySummaryFromJson(json);
}
