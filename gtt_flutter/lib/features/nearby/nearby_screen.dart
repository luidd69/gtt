import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/arrivals_api.dart';
import '../../core/api/stops_api.dart';
import '../../core/models/arrival.dart';
import '../../core/models/stop.dart';
import '../../core/providers/location_provider.dart';
import '../../core/providers/favorites_provider.dart';
import '../../core/theme/colors.dart';
import '../../widgets/route_chip.dart';
import '../../widgets/stop_card.dart';

// Coordinate centro Torino
const _torinoCentroLat = 45.0703;
const _torinoCentroLon = 7.6869;

final _nearbyCoordProvider = StateProvider<(double, double)?>((_) => null);

final nearbyStopsProvider = FutureProvider.autoDispose<List<Stop>>((ref) async {
  final override = ref.watch(_nearbyCoordProvider);
  if (override != null) {
    return ref.watch(stopsApiProvider).nearby(override.$1, override.$2);
  }
  final loc = ref.watch(locationProvider).valueOrNull;
  if (loc == null || !loc.hasLocation) return [];
  return ref.watch(stopsApiProvider).nearby(loc.lat!, loc.lon!);
});

final _miniArrivalsProvider =
    FutureProvider.autoDispose.family<List<Arrival>, String>(
  (ref, stopId) =>
      ref.watch(arrivalsApiProvider).getArrivals(stopId, limit: 3),
);

class NearbyScreen extends ConsumerWidget {
  const NearbyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final nearbyAsync = ref.watch(nearbyStopsProvider);
    final locState = ref.watch(locationProvider).valueOrNull;
    final coordOverride = ref.watch(_nearbyCoordProvider);
    final usingFallback = coordOverride != null;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Vicino a te'),
        actions: [
          IconButton(
            icon: const Icon(Icons.my_location),
            onPressed: () {
              ref.read(_nearbyCoordProvider.notifier).state = null;
              ref.read(locationProvider.notifier).fetch();
            },
          ),
        ],
      ),
      body: nearbyAsync.when(
        data: (stops) {
          final hasGps = locState?.hasLocation == true || usingFallback;

          if (!hasGps) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.location_off,
                        size: 56, color: AppColors.text3),
                    const SizedBox(height: 12),
                    const Text(
                      'Posizione non disponibile',
                      style:
                          TextStyle(color: AppColors.text2, fontSize: 16),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Abilita il GPS oppure visualizza le fermate vicino al centro di Torino.',
                      style: TextStyle(color: AppColors.text3, fontSize: 13),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 20),
                    FilledButton.icon(
                      icon: const Icon(Icons.location_city),
                      label: const Text('Mostra fermate a Torino centro'),
                      onPressed: () => ref
                          .read(_nearbyCoordProvider.notifier)
                          .state = (_torinoCentroLat, _torinoCentroLon),
                    ),
                  ],
                ),
              ),
            );
          }

          if (stops.isEmpty) {
            return const Center(
                child: Text('Nessuna fermata nelle vicinanze'));
          }

          final favs =
              ref.watch(favoritesProvider).valueOrNull?.favorites ?? const [];

          return ListView(
            children: [
              if (usingFallback)
                Container(
                  margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Row(
                    children: [
                      Text('📍', style: TextStyle(fontSize: 16)),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Mostrando fermate vicino a Torino centro',
                          style: TextStyle(
                              color: Color(0xFF92400E), fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),
              ...stops.map(
                (s) => _NearbyStopCard(
                  stop: s,
                  isFavorite: favs.any((f) => f.stopId == s.stopId),
                  onTap: () =>
                      context.push('/stops/${Uri.encodeComponent(s.stopId)}'),
                  onFavoriteTap: () =>
                      ref.read(favoritesProvider.notifier).toggle(s),
                ),
              ),
              const SizedBox(height: 24),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Errore: $e')),
      ),
    );
  }
}

// StopCard espansa con mini-arrivi inline
class _NearbyStopCard extends ConsumerWidget {
  final Stop stop;
  final bool isFavorite;
  final VoidCallback onTap;
  final VoidCallback onFavoriteTap;

  const _NearbyStopCard({
    required this.stop,
    required this.isFavorite,
    required this.onTap,
    required this.onFavoriteTap,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final arrivalsAsync = ref.watch(_miniArrivalsProvider(stop.stopId));

    return Column(
      children: [
        StopCard(
          stop: stop,
          isFavorite: isFavorite,
          onTap: onTap,
          onFavoriteTap: onFavoriteTap,
        ),
        // Mini-arrivi inline
        arrivalsAsync.when(
          data: (arrivals) {
            if (arrivals.isEmpty) return const SizedBox.shrink();
            return Container(
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 6),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                children: arrivals
                    .map((a) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 2),
                          child: Row(
                            children: [
                              RouteChip(
                                shortName: a.routeShortName,
                                color: a.routeColor,
                                textColor: a.routeTextColor,
                                small: true,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  a.headsign,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 12),
                                ),
                              ),
                              if (a.isRealtime)
                                Container(
                                  width: 6,
                                  height: 6,
                                  margin: const EdgeInsets.only(right: 4),
                                  decoration: const BoxDecoration(
                                    color: AppColors.onTime,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              Text(
                                a.waitMinutes != null
                                    ? '${a.waitMinutes} min'
                                    : a.displayTime,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ))
                    .toList(),
              ),
            );
          },
          loading: () => const SizedBox.shrink(),
          error: (_, __) => const SizedBox.shrink(),
        ),
      ],
    );
  }
}
