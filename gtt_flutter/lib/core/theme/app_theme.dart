import 'package:flutter/material.dart';
import 'colors.dart';

class AppTheme {
  AppTheme._();

  static ThemeData light() => ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.brand,
          brightness: Brightness.light,
          primary: AppColors.brand,
          onPrimary: Colors.white,
          secondary: AppColors.brandLight,
          onSecondary: Colors.white,
          surface: AppColors.surface1,
          surfaceContainerHighest: AppColors.surface3,
        ),
        scaffoldBackgroundColor: AppColors.surface3,
        appBarTheme: const AppBarTheme(
          backgroundColor: AppColors.surface1,
          foregroundColor: AppColors.text1,
          elevation: 0,
          scrolledUnderElevation: 1,
          shadowColor: AppColors.divider,
          titleTextStyle: TextStyle(
            color: AppColors.text1,
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
          iconTheme: IconThemeData(color: AppColors.text2),
        ),
        cardTheme: CardThemeData(
          color: AppColors.surface1,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: AppColors.divider, width: 0.8),
          ),
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: AppColors.surface1,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: AppColors.divider),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: AppColors.divider),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: AppColors.brand, width: 2),
          ),
          hintStyle: const TextStyle(color: AppColors.text3, fontSize: 15),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.brand,
            foregroundColor: Colors.white,
            textStyle:
                const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            minimumSize: const Size(0, 48),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.brand,
            side: const BorderSide(color: AppColors.brand),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            minimumSize: const Size(0, 44),
          ),
        ),
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
            foregroundColor: AppColors.brand,
            textStyle: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
        textTheme: const TextTheme(
          displayLarge:
              TextStyle(color: AppColors.text1, fontWeight: FontWeight.w800),
          displayMedium:
              TextStyle(color: AppColors.text1, fontWeight: FontWeight.w800),
          displaySmall:
              TextStyle(color: AppColors.text1, fontWeight: FontWeight.w700),
          headlineLarge: TextStyle(
              color: AppColors.text1,
              fontWeight: FontWeight.w700,
              fontSize: 24),
          headlineMedium: TextStyle(
              color: AppColors.text1,
              fontWeight: FontWeight.w700,
              fontSize: 20),
          headlineSmall: TextStyle(
              color: AppColors.text1,
              fontWeight: FontWeight.w700,
              fontSize: 18),
          titleLarge: TextStyle(
              color: AppColors.text1,
              fontWeight: FontWeight.w700,
              fontSize: 17),
          titleMedium: TextStyle(
              color: AppColors.text1,
              fontWeight: FontWeight.w600,
              fontSize: 15),
          titleSmall: TextStyle(
              color: AppColors.text2,
              fontWeight: FontWeight.w600,
              fontSize: 13),
          bodyLarge: TextStyle(color: AppColors.text1, fontSize: 15),
          bodyMedium: TextStyle(color: AppColors.text1, fontSize: 14),
          bodySmall: TextStyle(color: AppColors.text2, fontSize: 12),
          labelLarge: TextStyle(
              color: AppColors.text1,
              fontWeight: FontWeight.w600,
              fontSize: 14),
          labelMedium: TextStyle(
              color: AppColors.text2,
              fontWeight: FontWeight.w500,
              fontSize: 12),
          labelSmall: TextStyle(
              color: AppColors.text3,
              fontWeight: FontWeight.w500,
              fontSize: 11),
        ),
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: AppColors.surface1,
          indicatorColor: AppColors.brand.withAlpha(26),
          iconTheme: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return const IconThemeData(color: AppColors.brand, size: 22);
            }
            return const IconThemeData(color: AppColors.text3, size: 22);
          }),
          labelTextStyle: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return const TextStyle(
                  color: AppColors.brand,
                  fontWeight: FontWeight.w700,
                  fontSize: 11);
            }
            return const TextStyle(
                color: AppColors.text3,
                fontWeight: FontWeight.w500,
                fontSize: 11);
          }),
          elevation: 0,
        ),
        bottomNavigationBarTheme: const BottomNavigationBarThemeData(
          backgroundColor: AppColors.surface1,
          selectedItemColor: AppColors.brand,
          unselectedItemColor: AppColors.text3,
          selectedLabelStyle:
              TextStyle(fontWeight: FontWeight.w700, fontSize: 11),
          unselectedLabelStyle:
              TextStyle(fontWeight: FontWeight.w500, fontSize: 11),
          type: BottomNavigationBarType.fixed,
          elevation: 0,
        ),
        dividerColor: AppColors.divider,
        dividerTheme: const DividerThemeData(
          color: AppColors.divider,
          thickness: 0.8,
          space: 1,
        ),
        listTileTheme: const ListTileThemeData(
          contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 2),
          minVerticalPadding: 8,
        ),
        chipTheme: ChipThemeData(
          backgroundColor: AppColors.surface3,
          labelStyle:
              const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        ),
      );

  static ThemeData dark() => ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.brand,
          brightness: Brightness.dark,
          surface: AppColors.darkSurface1,
          primary: AppColors.brandLight,
          onPrimary: Colors.white,
        ),
        scaffoldBackgroundColor: AppColors.darkSurface1,
        appBarTheme: const AppBarTheme(
          backgroundColor: AppColors.darkSurface1,
          foregroundColor: AppColors.darkText1,
          elevation: 0,
          scrolledUnderElevation: 1,
          shadowColor: AppColors.darkDivider,
          titleTextStyle: TextStyle(
            color: AppColors.darkText1,
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
          iconTheme: IconThemeData(color: AppColors.darkText2),
        ),
        cardTheme: CardThemeData(
          color: AppColors.darkSurface2,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: AppColors.darkDivider, width: 0.8),
          ),
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: AppColors.darkSurface2,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: AppColors.darkDivider),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: AppColors.darkDivider),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: AppColors.brandLight, width: 2),
          ),
          hintStyle: const TextStyle(color: AppColors.darkText2, fontSize: 15),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.brandLight,
            foregroundColor: Colors.white,
            textStyle:
                const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            minimumSize: const Size(0, 48),
          ),
        ),
        textTheme: const TextTheme(
          displayLarge: TextStyle(
              color: AppColors.darkText1, fontWeight: FontWeight.w800),
          headlineLarge: TextStyle(
              color: AppColors.darkText1,
              fontWeight: FontWeight.w700,
              fontSize: 24),
          headlineMedium: TextStyle(
              color: AppColors.darkText1,
              fontWeight: FontWeight.w700,
              fontSize: 20),
          titleLarge: TextStyle(
              color: AppColors.darkText1,
              fontWeight: FontWeight.w700,
              fontSize: 17),
          titleMedium: TextStyle(
              color: AppColors.darkText1,
              fontWeight: FontWeight.w600,
              fontSize: 15),
          titleSmall: TextStyle(
              color: AppColors.darkText2,
              fontWeight: FontWeight.w600,
              fontSize: 13),
          bodyLarge: TextStyle(color: AppColors.darkText1, fontSize: 15),
          bodyMedium: TextStyle(color: AppColors.darkText1, fontSize: 14),
          bodySmall: TextStyle(color: AppColors.darkText2, fontSize: 12),
          labelSmall: TextStyle(
              color: AppColors.darkText2,
              fontWeight: FontWeight.w500,
              fontSize: 11),
        ),
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: AppColors.darkSurface2,
          indicatorColor: AppColors.brandLight.withAlpha(40),
          iconTheme: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return const IconThemeData(color: AppColors.brandLight, size: 22);
            }
            return const IconThemeData(color: AppColors.darkText3, size: 22);
          }),
          elevation: 0,
        ),
        bottomNavigationBarTheme: const BottomNavigationBarThemeData(
          backgroundColor: AppColors.darkSurface2,
          selectedItemColor: AppColors.brandLight,
          unselectedItemColor: AppColors.darkText3,
          selectedLabelStyle:
              TextStyle(fontWeight: FontWeight.w700, fontSize: 11),
          type: BottomNavigationBarType.fixed,
          elevation: 0,
        ),
        dividerColor: AppColors.darkDivider,
        dividerTheme: const DividerThemeData(
          color: AppColors.darkDivider,
          thickness: 0.8,
          space: 1,
        ),
      );
}
