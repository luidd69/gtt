import 'package:flutter/material.dart';
import '../core/theme/colors.dart';

class RouteChip extends StatelessWidget {
  final String shortName;
  final String? color;
  final String? textColor;
  final double fontSize;

  const RouteChip({
    super.key,
    required this.shortName,
    this.color,
    this.textColor,
    this.fontSize = 13,
  });

  Color _parseColor(String? hex, Color fallback) {
    if (hex == null || hex.isEmpty) return fallback;
    try {
      final clean = hex.replaceFirst('#', '');
      final full = clean.length == 6 ? 'FF$clean' : clean;
      return Color(int.parse(full, radix: 16));
    } catch (_) {
      return fallback;
    }
  }

  @override
  Widget build(BuildContext context) {
    final bgColor = _parseColor(color, AppColors.brand);
    final fgColor = _parseColor(textColor, Colors.white);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        shortName,
        style: TextStyle(
          color: fgColor,
          fontWeight: FontWeight.w800,
          fontSize: fontSize,
          height: 1.2,
        ),
      ),
    );
  }
}
