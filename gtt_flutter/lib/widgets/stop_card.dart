import 'package:flutter/material.dart';
import '../core/models/stop.dart';
import '../core/theme/colors.dart';
import 'route_chip.dart';

class StopCard extends StatelessWidget {
  final Stop stop;
  final bool isFavorite;
  final VoidCallback? onTap;
  final VoidCallback? onFavoriteTap;

  const StopCard({
    super.key,
    required this.stop,
    this.isFavorite = false,
    this.onTap,
    this.onFavoriteTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.divider),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Stop code bubble
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.brand.withAlpha(20),
                borderRadius: BorderRadius.circular(10),
              ),
              alignment: Alignment.center,
              child: Text(
                stop.stopCode.isNotEmpty ? stop.stopCode : '#',
                style: const TextStyle(
                  color: AppColors.brand,
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                ),
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    stop.stopName,
                    style: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w600),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (stop.distanceM != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      '${stop.distanceM! < 1000 ? '${stop.distanceM} m' : '${(stop.distanceM! / 1000).toStringAsFixed(1)} km'}',
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: AppColors.text3),
                    ),
                  ],
                  if (stop.routes.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 4,
                      runSpacing: 4,
                      children: stop.routes
                          .take(8)
                          .map((r) => RouteChip(
                                shortName: r.shortName,
                                color: r.color,
                                textColor: r.textColor,
                                fontSize: 11,
                              ))
                          .toList(),
                    ),
                  ],
                ],
              ),
            ),
            if (onFavoriteTap != null)
              IconButton(
                onPressed: onFavoriteTap,
                icon: Icon(
                  isFavorite ? Icons.star_rounded : Icons.star_outline_rounded,
                  color: isFavorite ? Colors.amber : AppColors.text3,
                ),
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
              ),
          ],
        ),
      ),
    );
  }
}
