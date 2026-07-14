import 'package:flutter/material.dart';

class AppColours {
  AppColours._();

  // Primary brand — matches web sidebar
  static const Color primary       = Color(0xFF1F4E79);
  static const Color primaryLight  = Color(0xFF2E5F8A);
  static const Color primaryAccent = Color(0xFF4472C4);

  // Status colours — mirror web StatusBadge
  static const Color statusDraft     = Color(0xFF6B7280); // gray-500
  static const Color statusSubmitted = Color(0xFF3B82F6); // blue-500
  static const Color statusApproved  = Color(0xFF10B981); // green-500
  static const Color statusRejected  = Color(0xFFEF4444); // red-500
  static const Color statusCancelled = Color(0xFF9CA3AF); // gray-400
  static const Color statusPartial   = Color(0xFFF59E0B); // amber-500
  static const Color statusPosted    = Color(0xFF8B5CF6); // purple-500
  static const Color statusPaid      = Color(0xFF059669); // emerald-600
  static const Color statusClosed    = Color(0xFF374151); // gray-700
  static const Color statusPoCreated = Color(0xFF6366F1); // indigo-500
  static const Color statusEnquiry   = Color(0xFF0EA5E9); // sky-500

  // Surface
  static const Color surface     = Color(0xFFFFFFFF);
  static const Color background  = Color(0xFFF3F4F6);
  static const Color cardBorder  = Color(0xFFE5E7EB);

  // KPI tile accents
  static const Color kpiBlue   = Color(0xFFEFF6FF);
  static const Color kpiGreen  = Color(0xFFF0FDF4);
  static const Color kpiAmber  = Color(0xFFFFFBEB);
  static const Color kpiRed    = Color(0xFFFEF2F2);
  static const Color kpiPurple = Color(0xFFF5F3FF);

  // Text
  static const Color textPrimary   = Color(0xFF111827);
  static const Color textSecondary = Color(0xFF6B7280);
  static const Color textHint      = Color(0xFF9CA3AF);

  // Error
  static const Color error = Color(0xFFDC2626);
}
