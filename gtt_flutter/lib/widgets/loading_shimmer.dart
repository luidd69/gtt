import 'package:flutter/material.dart';

class LoadingShimmer extends StatefulWidget {
  final double width;
  final double height;
  final double borderRadius;

  const LoadingShimmer({
    super.key,
    this.width = double.infinity,
    this.height = 20,
    this.borderRadius = 8,
  });

  const LoadingShimmer.line({super.key, double? width})
      : width = width ?? double.infinity,
        height = 16,
        borderRadius = 6;

  const LoadingShimmer.card({super.key})
      : width = double.infinity,
        height = 80,
        borderRadius = 12;

  @override
  State<LoadingShimmer> createState() => _LoadingShimmerState();
}

class _LoadingShimmerState extends State<LoadingShimmer>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
    _anim = CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final base = isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0);
    final highlight = isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9);

    return AnimatedBuilder(
      animation: _anim,
      builder: (_, __) => Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(widget.borderRadius),
          gradient: LinearGradient(
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
            colors: [
              base,
              Color.lerp(base, highlight, _anim.value) ?? highlight,
              base,
            ],
            stops: [0, 0.5, 1],
          ),
        ),
      ),
    );
  }
}

class StopCardSkeleton extends StatelessWidget {
  const StopCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(children: [
        const LoadingShimmer(width: 40, height: 40, borderRadius: 10),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const LoadingShimmer(height: 14),
              const SizedBox(height: 6),
              LoadingShimmer(width: MediaQuery.of(context).size.width * 0.3, height: 12),
              const SizedBox(height: 8),
              const Row(children: [
                LoadingShimmer(width: 32, height: 22, borderRadius: 6),
                SizedBox(width: 4),
                LoadingShimmer(width: 32, height: 22, borderRadius: 6),
                SizedBox(width: 4),
                LoadingShimmer(width: 32, height: 22, borderRadius: 6),
              ]),
            ],
          ),
        ),
      ]),
    );
  }
}
