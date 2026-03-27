import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/models/itinerary.dart';
import '../../core/models/leg.dart';
import '../../core/theme/colors.dart';
import '../../widgets/route_chip.dart';

class ItineraryDetailScreen extends StatelessWidget {
  final Itinerary itinerary;
  const ItineraryDetailScreen({super.key, required this.itinerary});

  @override
  Widget build(BuildContext context) {
    final it = itinerary;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${it.departureTime} → ${it.arrivalTime}',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
            ),
            Text(
              '${it.durationMinutes} min · ${it.transfers == 0 ? 'diretto' : '${it.transfers} cambi'}',
              style: const TextStyle(fontSize: 12, color: AppColors.text3),
            ),
          ],
        ),
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: it.legs.length,
        itemBuilder: (_, i) => _LegTile(leg: it.legs[i], isLast: i == it.legs.length - 1),
      ),
    );
  }
}

class _LegTile extends StatefulWidget {
  final Leg leg;
  final bool isLast;
  const _LegTile({required this.leg, required this.isLast});

  @override
  State<_LegTile> createState() => _LegTileState();
}

class _LegTileState extends State<_LegTile> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final leg = widget.leg;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Timeline bar
          SizedBox(
            width: 32,
            child: Column(
              children: [
                Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    color: leg.isTransit
                        ? _parseColor(leg.routeColor, AppColors.brand)
                        : AppColors.text3,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                  ),
                ),
                Expanded(
                  child: Container(
                    width: 2,
                    color: leg.isWalk
                        ? AppColors.text3.withAlpha(80)
                        : _parseColor(leg.routeColor, AppColors.brand),
                    margin: const EdgeInsets.symmetric(horizontal: 5),
                  ),
                ),
                if (!widget.isLast)
                  Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.text3),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          // Content
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: leg.isWalk ? _WalkLegContent(leg: leg) : _TransitLegContent(
                leg: leg,
                expanded: _expanded,
                onToggle: () => setState(() => _expanded = !_expanded),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Color _parseColor(String? hex, Color fallback) {
    if (hex == null || hex.isEmpty) return fallback;
    try {
      final clean = hex.replaceFirst('#', '');
      return Color(int.parse('FF$clean', radix: 16));
    } catch (_) {
      return fallback;
    }
  }
}

class _WalkLegContent extends StatelessWidget {
  final Leg leg;
  const _WalkLegContent({required this.leg});

  @override
  Widget build(BuildContext context) {
    final m = leg.distanceM.round();
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: AppColors.divider,
          style: BorderStyle.solid,
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.directions_walk, color: AppColors.text3, size: 20),
          const SizedBox(width: 8),
          Text(
            '${(leg.durationSeconds ~/ 60)} min a piedi',
            style: const TextStyle(color: AppColors.text2, fontWeight: FontWeight.w500),
          ),
          const Spacer(),
          Text(
            m < 1000 ? '$m m' : '${(m / 1000).toStringAsFixed(1)} km',
            style: const TextStyle(color: AppColors.text3, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class _TransitLegContent extends StatelessWidget {
  final Leg leg;
  final bool expanded;
  final VoidCallback onToggle;

  const _TransitLegContent({
    required this.leg,
    required this.expanded,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    RouteChip(
                      shortName: leg.routeShortName ?? '?',
                      color: leg.routeColor,
                      textColor: leg.routeTextColor,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        leg.headsign ?? '',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      '${leg.startTime} → ${leg.endTime}',
                      style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.text2,
                          fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
                if (leg.fromStop != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    'Da: ${leg.fromStop!.stopName}',
                    style: const TextStyle(color: AppColors.text2, fontSize: 13),
                  ),
                ],
                if (leg.toStop != null)
                  Text(
                    'A: ${leg.toStop!.stopName}',
                    style: const TextStyle(color: AppColors.text2, fontSize: 13),
                  ),
              ],
            ),
          ),
          if (leg.intermediateStops.isNotEmpty)
            InkWell(
              onTap: onToggle,
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    Text(
                      '${leg.intermediateStops.length} fermate intermedie',
                      style: const TextStyle(
                          color: AppColors.brand,
                          fontSize: 12,
                          fontWeight: FontWeight.w600),
                    ),
                    Icon(
                      expanded
                          ? Icons.keyboard_arrow_up
                          : Icons.keyboard_arrow_down,
                      color: AppColors.brand,
                      size: 16,
                    ),
                  ],
                ),
              ),
            ),
          if (expanded)
            ...leg.intermediateStops.map(
              (s) => Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 6),
                child: Row(
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: AppColors.text3,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(s.stopName,
                        style: const TextStyle(
                            color: AppColors.text2, fontSize: 12)),
                    const Spacer(),
                    if (s.departureTime != null)
                      Text(s.departureTime!,
                          style:
                              const TextStyle(color: AppColors.text3, fontSize: 12)),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 4),
        ],
      ),
    );
  }
}
