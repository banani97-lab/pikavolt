import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Pikavolt brand palette v2 — mascot-derived, dark theme only.
/// See docs/brand.md ("Palette (mascot-derived)").
abstract final class AppColors {
  /// `storm` — page background, near-black with deep teal cast.
  static const Color background = Color(0xFF081A21);

  /// Cards / panels — dark teal.
  static const Color surface = Color(0xFF0E2A33);

  /// Brand field color (exact mascot backdrop). Section washes, gradients.
  static const Color teal = Color(0xFF2A5E73);

  /// Gradient partner for [teal], hovers.
  static const Color tealDeep = Color(0xFF1B4254);

  /// Primary accent — CTAs, highlights.
  static const Color voltYellow = Color(0xFFFFE600);

  /// Secondary accent — exact mascot fur gold.
  static const Color amber = Color(0xFFDB9C38);

  /// Electric cyan — lightning accents.
  static const Color arcBlue = Color(0xFF22D3EE);

  /// 24/7 emergency elements only.
  static const Color emergency = Color(0xFFFF3B30);
  static const Color error = emergency;

  static const Color onDark = Color(0xFFF8FAFC);
  static const Color mutedText = Color(0xFF9FB8C2);
  static const Color outline = Color(0xFF1B4254);
}

/// Builds the single (dark) app theme.
///
/// Display text uses Anton (heavy, condensed — the "PIKAVOLT" voice); body
/// text uses Inter.
abstract final class AppTheme {
  static ThemeData dark() {
    const colorScheme = ColorScheme.dark(
      surface: AppColors.surface,
      surfaceContainerLowest: AppColors.background,
      primary: AppColors.voltYellow,
      onPrimary: Colors.black,
      secondary: AppColors.teal,
      onSecondary: Colors.white,
      tertiary: AppColors.amber,
      onTertiary: Colors.black,
      error: AppColors.error,
      onError: Colors.white,
      onSurface: AppColors.onDark,
      onSurfaceVariant: AppColors.mutedText,
      outline: AppColors.outline,
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: AppColors.background,
    );

    final bodyTheme = GoogleFonts.interTextTheme(base.textTheme);
    final textTheme = bodyTheme.copyWith(
      displayLarge: GoogleFonts.anton(
        textStyle: bodyTheme.displayLarge,
        letterSpacing: 1.0,
      ),
      displayMedium: GoogleFonts.anton(
        textStyle: bodyTheme.displayMedium,
        letterSpacing: 1.0,
      ),
      displaySmall: GoogleFonts.anton(
        textStyle: bodyTheme.displaySmall,
        letterSpacing: 0.5,
      ),
      headlineLarge: GoogleFonts.anton(textStyle: bodyTheme.headlineLarge),
      headlineMedium: GoogleFonts.anton(textStyle: bodyTheme.headlineMedium),
      headlineSmall: GoogleFonts.anton(textStyle: bodyTheme.headlineSmall),
    );

    return base.copyWith(
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.onDark,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: textTheme.headlineSmall?.copyWith(
          color: AppColors.onDark,
        ),
      ),
      cardTheme: const CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(16)),
          side: BorderSide(color: AppColors.outline),
        ),
      ),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: AppColors.surface,
        side: const BorderSide(color: AppColors.outline),
        labelStyle: const TextStyle(color: AppColors.onDark),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.voltYellow,
          foregroundColor: Colors.black,
          disabledBackgroundColor: AppColors.voltYellow.withValues(alpha: 0.3),
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: GoogleFonts.inter(
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.onDark,
          side: const BorderSide(color: AppColors.outline),
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: GoogleFonts.inter(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: AppColors.voltYellow),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        hintStyle: const TextStyle(color: AppColors.mutedText),
        labelStyle: const TextStyle(color: AppColors.mutedText),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.voltYellow, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.error, width: 2),
        ),
      ),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: AppColors.surface,
        contentTextStyle: TextStyle(color: AppColors.onDark),
        behavior: SnackBarBehavior.floating,
      ),
      dividerTheme: const DividerThemeData(color: AppColors.outline),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.voltYellow,
      ),
      tabBarTheme: const TabBarThemeData(
        labelColor: AppColors.voltYellow,
        unselectedLabelColor: AppColors.mutedText,
        indicatorColor: AppColors.voltYellow,
        dividerColor: AppColors.outline,
      ),
      checkboxTheme: CheckboxThemeData(
        side: const BorderSide(color: AppColors.mutedText, width: 1.5),
        fillColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? AppColors.voltYellow
              : Colors.transparent,
        ),
        checkColor: const WidgetStatePropertyAll(Colors.black),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
      ),
      dialogTheme: const DialogThemeData(backgroundColor: AppColors.surface),
    );
  }
}
