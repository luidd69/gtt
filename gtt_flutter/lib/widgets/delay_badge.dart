import 'package:flutter/material.dart';
import '../core/theme/colors.dart';

enum DelayLevel { onTime, lightDelay, heavyDelay, early }

class DelayBadge extends StatelessWidget {
  final int? delaySeconds;
  final bool isRealtime;

  const DelayBadge({super.key, this.delaySeconds, required this.isRealtime});

  DelayLevel get _level {
    final d = delaySeconds ?? 0;
    if (d > 300) return DelayLevel.heavyDelay;
    if (d > 60) return DelayLevel.lightDelay;
    if (d < -30) return DelayLevel.early;
    return DelayLevel.onTime;
  }

  @override
  Widget build(BuildContext context) {
    if (!isRealtime) {
      return _Badge(
        label: 'Orario',
        bg: const Color(0xFFF1F5F9),
        fg: AppColors.text3,
      );
    }

    return switch (_level) {
      DelayLevel.onTime => _Badge(
          label: 'Puntuale',
          bg: AppColors.onTimeBg,
          fg: AppColors.onTime,
        ),
      DelayLevel.lightDelay => _Badge(
          label: '+${(delaySeconds! ~/ 60)} min',
          bg: AppColors.delayLightBg,
          fg: AppColors.delayLight,
        ),
      DelayLevel.heavyDelay => _Badge(
          label: '+${(delaySeconds! ~/ 60)} min',
          bg: AppColors.delayHeavyBg,
          fg: AppColors.delayHeavy,
        ),
      DelayLevel.early => _Badge(
          label: '${(delaySeconds! ~/ 60)} min',
          bg: AppColors.earlyBg,
          fg: AppColors.early,
        ),
    };
  }
}

class _Badge extends StatelessWidget {
  final String label;
  final Color bg;
  final Color fg;

  const _Badge({required this.label, required this.bg, required this.fg});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: fg,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
      );
}
