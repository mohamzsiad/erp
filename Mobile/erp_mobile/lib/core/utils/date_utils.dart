import 'package:intl/intl.dart';

/// Date-specific utilities (complement to FormatUtils).
class AppDateUtils {
  AppDateUtils._();

  static bool isOverdue(DateTime? dueDate) {
    if (dueDate == null) return false;
    return dueDate.isBefore(DateTime.now());
  }

  static int daysUntil(DateTime date) =>
      date.difference(DateTime.now()).inDays;

  static DateTime startOfMonth(DateTime date) =>
      DateTime(date.year, date.month, 1);

  static DateTime endOfMonth(DateTime date) =>
      DateTime(date.year, date.month + 1, 0);
}
