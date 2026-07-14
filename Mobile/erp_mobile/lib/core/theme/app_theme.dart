import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colours.dart';

class AppTheme {
  AppTheme._();

  static ThemeData get lightTheme {
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColours.primary,
        primary: AppColours.primary,
        secondary: AppColours.primaryAccent,
        surface: AppColours.surface,
        background: AppColours.background,
        error: AppColours.error,
        brightness: Brightness.light,
      ),
      scaffoldBackgroundColor: AppColours.background,
      dividerColor: AppColours.cardBorder,
    );

    final textTheme = GoogleFonts.interTextTheme(base.textTheme).copyWith(
      displayLarge: GoogleFonts.inter(
          fontSize: 32, fontWeight: FontWeight.bold, color: AppColours.textPrimary),
      displayMedium: GoogleFonts.inter(
          fontSize: 28, fontWeight: FontWeight.bold, color: AppColours.textPrimary),
      headlineLarge: GoogleFonts.inter(
          fontSize: 24, fontWeight: FontWeight.w600, color: AppColours.textPrimary),
      headlineMedium: GoogleFonts.inter(
          fontSize: 20, fontWeight: FontWeight.w600, color: AppColours.textPrimary),
      headlineSmall: GoogleFonts.inter(
          fontSize: 18, fontWeight: FontWeight.w600, color: AppColours.textPrimary),
      titleLarge: GoogleFonts.inter(
          fontSize: 16, fontWeight: FontWeight.w600, color: AppColours.textPrimary),
      titleMedium: GoogleFonts.inter(
          fontSize: 14, fontWeight: FontWeight.w500, color: AppColours.textPrimary),
      titleSmall: GoogleFonts.inter(
          fontSize: 12, fontWeight: FontWeight.w500, color: AppColours.textSecondary),
      bodyLarge: GoogleFonts.inter(
          fontSize: 16, fontWeight: FontWeight.normal, color: AppColours.textPrimary),
      bodyMedium: GoogleFonts.inter(
          fontSize: 14, fontWeight: FontWeight.normal, color: AppColours.textPrimary),
      bodySmall: GoogleFonts.inter(
          fontSize: 12, fontWeight: FontWeight.normal, color: AppColours.textSecondary),
      labelLarge: GoogleFonts.inter(
          fontSize: 14, fontWeight: FontWeight.w600, color: AppColours.surface),
      labelMedium: GoogleFonts.inter(
          fontSize: 12, fontWeight: FontWeight.w500, color: AppColours.textPrimary),
      labelSmall: GoogleFonts.inter(
          fontSize: 10, fontWeight: FontWeight.w500, color: AppColours.textSecondary),
    );

    return base.copyWith(
      textTheme: textTheme,
      primaryTextTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.inter(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: AppColours.surface,
        ),
        iconTheme: const IconThemeData(color: AppColours.surface),
      ),
      cardTheme: CardTheme(
        color: AppColours.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColours.cardBorder),
        ),
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColours.primary,
          foregroundColor: AppColours.surface,
          minimumSize: const Size(double.infinity, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600),
          elevation: 0,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColours.primary,
          side: const BorderSide(color: AppColours.primary),
          minimumSize: const Size(double.infinity, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColours.primary,
          textStyle: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColours.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColours.cardBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColours.cardBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColours.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColours.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColours.error, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        hintStyle: GoogleFonts.inter(color: AppColours.textHint, fontSize: 14),
        labelStyle: GoogleFonts.inter(color: AppColours.textSecondary, fontSize: 14),
        errorStyle: GoogleFonts.inter(color: AppColours.error, fontSize: 12),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColours.background,
        selectedColor: AppColours.primary,
        secondarySelectedColor: AppColours.primary,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        labelStyle: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500),
        secondaryLabelStyle: GoogleFonts.inter(
            fontSize: 12, fontWeight: FontWeight.w500, color: AppColours.surface),
        side: const BorderSide(color: AppColours.cardBorder),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColours.surface,
        selectedItemColor: AppColours.primary,
        unselectedItemColor: AppColours.textHint,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
      dividerTheme: const DividerThemeData(
        color: AppColours.cardBorder,
        thickness: 1,
        space: 1,
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        contentTextStyle: GoogleFonts.inter(fontSize: 14, color: AppColours.surface),
      ),
      tabBarTheme: TabBarTheme(
        labelStyle: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
        unselectedLabelStyle: GoogleFonts.inter(fontSize: 13),
        indicatorSize: TabBarIndicatorSize.tab,
        labelColor: AppColours.primary,
        unselectedLabelColor: AppColours.textSecondary,
      ),
    );
  }
}
