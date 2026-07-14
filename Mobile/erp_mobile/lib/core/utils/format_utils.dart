import 'package:intl/intl.dart';

/// Utility functions for currency and number formatting.
class FormatUtils {
  FormatUtils._();

  static final _omrFormat = NumberFormat('#,##0.000', 'en_US');
  static final _qtyFormat = NumberFormat('#,##0.###', 'en_US');
  static final _displayDate = DateFormat('dd-MM-yyyy');
  static final _apiDate     = DateFormat('yyyy-MM-dd');
  static final _displayDateTime = DateFormat('dd-MM-yyyy HH:mm');

  /// Formats a number as "OMR 12,345.678"
  static String formatAmount(num? amount, {bool showCurrency = true}) {
    if (amount == null) return showCurrency ? 'OMR 0.000' : '0.000';
    final formatted = _omrFormat.format(amount);
    return showCurrency ? 'OMR $formatted' : formatted;
  }

  /// Formats a quantity (up to 3 decimal places, trims trailing zeros)
  static String formatQty(num? qty) {
    if (qty == null) return '0';
    return _qtyFormat.format(qty);
  }

  /// Formats a date for display: dd-MM-yyyy
  static String formatDate(DateTime? date) {
    if (date == null) return '—';
    return _displayDate.format(date);
  }

  /// Parses a date string in yyyy-MM-dd format
  static DateTime? parseDate(String? s) {
    if (s == null || s.isEmpty) return null;
    try {
      return _apiDate.parseStrict(s);
    } catch (_) {
      return null;
    }
  }

  /// Formats a date for API calls: yyyy-MM-dd
  static String toApiDate(DateTime date) => _apiDate.format(date);

  /// Formats a DateTime for display: dd-MM-yyyy HH:mm
  static String formatDateTime(DateTime? dt) {
    if (dt == null) return '—';
    return _displayDateTime.format(dt);
  }

  /// Returns a human-readable relative time (e.g. "2 hours ago")
  static String timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 60) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return formatDate(dt);
  }

  /// Initials from a full name (max 2 characters)
  static String initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts.last[0]).toUpperCase();
  }
}
