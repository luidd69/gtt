import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/lines_api.dart';
import '../../core/models/route_line.dart';
import '../../core/providers/favorites_provider.dart';
import '../../core/theme/colors.dart';
import '../../widgets/route_chip.dart';

final lineDetailProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>(
  (ref, routeId) => ref.watch(linesApiProvider).getDetailRaw(routeId),
);

class LineDetailScreen extends ConsumerWidget {
  final String routeId;
  const LineDetailScreen({super.key, required this.routeId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(lineDetailProvider(routeId));
    final favAsync = ref.watch(favoritesProvider);
    final isFav = favAsync.valueOrNull?.favoriteLines.any((l) => l.routeId == routeId) ?? false;

    return Scaffold(
      body: detailAsync.when(
        data: (data) {
          final route = (data['route'] as Map?)?.cast<String, dynamic>() ?? {};
          final directions = (data['directions'] as List? ?? const []);
          final shortName =
              (route['route_short_name'] ?? route['shortName'] ?? '')
                  .toString();
          final longName =
              (route['route_long_name'] ?? route['longName'] ?? '').toString();
          final color = route['color']?.toString() ??
              route['route_color']?.toString();
          final textColor = route['textColor']?.toString() ??
              route['route_text_color']?.toString();

          // Costruisci RouteLine per toggle preferito
          final line = RouteLine(
            routeId: routeId,
            shortName: shortName,
            longName: longName,
            color: color,
            textColor: textColor,
            routeType: (route['routeType'] ?? route['route_type'] ?? 3) as int,
          );

          return CustomScrollView(
            slivers: [
              SliverAppBar(
                floating: true,
                snap: true,
                leading: IconButton(
                  icon: const Icon(Icons.arrow_back),
                  onPressed: () => context.pop(),
                ),
                title: Row(
                  children: [
                    RouteChip(
                        shortName: shortName, color: color, textColor: textColor),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        longName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 15),
                      ),
                    ),
                  ],
                ),
                actions: [
                  IconButton(
                    icon: Icon(
                      isFav ? Icons.star_rounded : Icons.star_outline_rounded,
                      color: isFav ? Colors.amber : null,
                    ),
                    tooltip: isFav
                        ? 'Rimuovi dai preferiti'
                        : 'Aggiungi ai preferiti',
                    onPressed: () =>
                        ref.read(favoritesProvider.notifier).toggleLine(line),
                  ),
                ],
              ),
              // Avvisi di servizio filtrati
              // Direzioni
              SliverPadding(
                padding: const EdgeInsets.all(16),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) {
                      final dir = (directions[i] as Map)
                          .cast<String, dynamic>();
                      final stops =
                          (dir['stops'] as List? ?? const []);
                      final firstStop = stops.isNotEmpty
                          ? (stops.first as Map).cast<String, dynamic>()
                          : null;
                      final lastStop = stops.isNotEmpty
                          ? (stops.last as Map).cast<String, dynamic>()
                          : null;

                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                (dir['headsign'] ?? 'Direzione').toString(),
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 15),
                              ),
                              // Card capolinea Da/A
                              if (firstStop != null && lastStop != null) ...[
                                const SizedBox(height: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: Theme.of(context)
                                        .colorScheme
                                        .surfaceContainerHighest,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.my_location,
                                          size: 14,
                                          color: AppColors.brand),
                                      const SizedBox(width: 6),
                                      Expanded(
                                        child: Text(
                                          (firstStop['stop_name'] ??
                                                  firstStop['stopName'] ??
                                                  '')
                                              .toString(),
                                          style: const TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      const Padding(
                                        padding: EdgeInsets.symmetric(
                                            horizontal: 4),
                                        child: Icon(Icons.arrow_forward,
                                            size: 14,
                                            color: AppColors.text3),
                                      ),
                                      Expanded(
                                        child: Text(
                                          (lastStop['stop_name'] ??
                                                  lastStop['stopName'] ??
                                                  '')
                                              .toString(),
                                          style: const TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          textAlign: TextAlign.right,
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      const Icon(Icons.location_on,
                                          size: 14,
                                          color: Color(0xFFE8431B)),
                                    ],
                                  ),
                                ),
                              ],
                              const SizedBox(height: 8),
                              ...stops.asMap().entries.map((entry) {
                                final i = entry.key;
                                final stop =
                                    (entry.value as Map).cast<String, dynamic>();
                                final stopId =
                                    (stop['stop_id'] ?? stop['stopId'] ?? '')
                                        .toString();
                                final stopName = (stop['stop_name'] ??
                                        stop['stopName'] ??
                                        '')
                                    .toString();
                                final stopCode = (stop['stop_code'] ??
                                        stop['stopCode'] ??
                                        '')
                                    .toString();
                                final deptTime = (stop['departure_time'] ??
                                        stop['departureTime'] ??
                                        '')
                                    .toString();
                                final deptDisplay = deptTime.length >= 5
                                    ? deptTime.substring(0, 5)
                                    : '';
                                final isFirst = i == 0;
                                final isLast = i == stops.length - 1;
                                final dotColor =
                                    (isFirst || isLast) ? color : null;

                                return InkWell(
                                  onTap: stopId.isNotEmpty
                                      ? () => context.push(
                                          '/stops/${Uri.encodeComponent(stopId)}')
                                      : null,
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(
                                        vertical: 6),
                                    child: Row(
                                      children: [
                                        Container(
                                          width: 26,
                                          height: 26,
                                          decoration: BoxDecoration(
                                            shape: BoxShape.circle,
                                            color: dotColor != null
                                                ? Color(int.tryParse(
                                                        'FF${dotColor.replaceFirst('#', '')}',
                                                        radix: 16) ??
                                                    0xFF007AFF)
                                                : Colors.transparent,
                                            border: Border.all(
                                              color: dotColor != null
                                                  ? Color(int.tryParse(
                                                          'FF${dotColor.replaceFirst('#', '')}',
                                                          radix: 16) ??
                                                      0xFF007AFF)
                                                  : AppColors.text3,
                                              width: 1.5,
                                            ),
                                          ),
                                          alignment: Alignment.center,
                                          child: Text(
                                            '${i + 1}',
                                            style: TextStyle(
                                              fontSize: 9,
                                              fontWeight: FontWeight.w700,
                                              color: dotColor != null
                                                  ? Colors.white
                                                  : AppColors.text3,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                stopName,
                                                style: TextStyle(
                                                  fontWeight: (isFirst ||
                                                          isLast)
                                                      ? FontWeight.w700
                                                      : FontWeight.w500,
                                                  fontSize: 13,
                                                ),
                                              ),
                                              if (stopCode.isNotEmpty)
                                                Text(
                                                  'Fermata $stopCode',
                                                  style: const TextStyle(
                                                    fontSize: 11,
                                                    color: AppColors.text3,
                                                  ),
                                                ),
                                            ],
                                          ),
                                        ),
                                        if (deptDisplay.isNotEmpty)
                                          Text(
                                            deptDisplay,
                                            style: const TextStyle(
                                              fontSize: 12,
                                              color: AppColors.text2,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        const SizedBox(width: 4),
                                        const Icon(Icons.chevron_right,
                                            size: 16,
                                            color: AppColors.text3),
                                      ],
                                    ),
                                  ),
                                );
                              }),
                            ],
                          ),
                        ),
                      );
                    },
                    childCount: directions.length,
                  ),
                ),
              ),
            ],
          );
        },
        loading: () =>
            const Scaffold(body: Center(child: CircularProgressIndicator())),
        error: (e, _) =>
            Scaffold(body: Center(child: Text('Errore: $e'))),
      ),
    );
  }
}
