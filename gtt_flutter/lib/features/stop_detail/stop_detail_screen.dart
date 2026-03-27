import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/providers/favorites_provider.dart';
import '../../core/theme/colors.dart';
import '../../widgets/bottom_nav.dart';
import '../../widgets/loading_shimmer.dart';
import '../../widgets/route_chip.dart';
import 'arrivals_provider.dart';
import 'arrival_row.dart';

class StopDetailScreen extends ConsumerWidget {
  final String stopId;
  const StopDetailScreen({super.key, required this.stopId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stopAsync = ref.watch(stopDetailProvider(stopId));
    final arrivalsAsync = ref.watch(arrivalsStreamProvider(stopId));
    final favAsync = ref.watch(favoritesProvider);
    final isFav = favAsync.valueOrNull?.favorites.any((f) => f.stopId == stopId) ?? false;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            floating: true,
            snap: true,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () => context.pop(),
            ),
            title: stopAsync.when(
              data: (stop) => Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(stop.stopName,
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  if (stop.stopCode.isNotEmpty)
                    Text('Fermata ${stop.stopCode}',
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.text3, fontWeight: FontWeight.w400)),
                ],
              ),
              loading: () => const Text('Caricamento…'),
              error: (_, __) => const Text('Errore'),
            ),
            actions: [
              // Toggle preferito
              stopAsync.when(
                data: (stop) => IconButton(
                  icon: Icon(
                    isFav ? Icons.star_rounded : Icons.star_outline_rounded,
                    color: isFav ? Colors.amber : null,
                  ),
                  onPressed: () =>
                      ref.read(favoritesProvider.notifier).toggle(stop),
                ),
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
              ),
            ],
          ),
          // Chip linee
          stopAsync.maybeWhen(
            data: (stop) {
              if (stop.routes.isEmpty) return const SliverToBoxAdapter(child: SizedBox.shrink());
              return SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                  child: Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: stop.routes
                        .map((r) => RouteChip(
                              shortName: r.shortName,
                              color: r.color,
                              textColor: r.textColor,
                            ))
                        .toList(),
                  ),
                ),
              );
            },
            orElse: () => const SliverToBoxAdapter(child: SizedBox.shrink()),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
              child: Row(
                children: [
                  Text(
                    'Prossimi arrivi',
                    style: Theme.of(context)
                        .textTheme
                        .titleSmall
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const Spacer(),
                  arrivalsAsync.when(
                    data: (_) => const _RealtimeDot(),
                    loading: () => const SizedBox.shrink(),
                    error: (_, __) => const SizedBox.shrink(),
                  ),
                ],
              ),
            ),
          ),
          arrivalsAsync.when(
            data: (arrivals) {
              if (arrivals.isEmpty) {
                return const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(
                      child: Column(
                        children: [
                          Icon(Icons.directions_bus_outlined, size: 48, color: AppColors.text3),
                          SizedBox(height: 8),
                          Text('Nessun arrivo previsto',
                              style: TextStyle(color: AppColors.text3)),
                        ],
                      ),
                    ),
                  ),
                );
              }
              return SliverList(
                delegate: SliverChildBuilderDelegate(
                  (_, i) => stopAsync.maybeWhen(
                    data: (stop) => ArrivalRow(
                      arrival: arrivals[i],
                      stopId: stopId,
                      stopName: stop.stopName,
                    ),
                    orElse: () => ArrivalRow(
                      arrival: arrivals[i],
                      stopId: stopId,
                      stopName: '',
                    ),
                  ),
                  childCount: arrivals.length,
                ),
              );
            },
            loading: () => SliverList(
              delegate: SliverChildBuilderDelegate(
                (_, __) => const _ArrivalRowSkeleton(),
                childCount: 6,
              ),
            ),
            error: (e, _) => SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Center(
                  child: Text('Errore: $e',
                      style: const TextStyle(color: AppColors.delayHeavy)),
                ),
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 80)),
        ],
      ),
      bottomNavigationBar: const BottomNav(currentIndex: -1),
    );
  }
}

class _RealtimeDot extends StatelessWidget {
  const _RealtimeDot();

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
              color: AppColors.onTime,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 4),
          const Text('Live',
              style: TextStyle(
                  fontSize: 12, color: AppColors.onTime, fontWeight: FontWeight.w600)),
        ],
      );
}

class _ArrivalRowSkeleton extends StatelessWidget {
  const _ArrivalRowSkeleton();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          const LoadingShimmer(width: 44, height: 26, borderRadius: 6),
          const SizedBox(width: 10),
          Expanded(child: LoadingShimmer(width: double.infinity, height: 14)),
          const SizedBox(width: 8),
          const LoadingShimmer(width: 48, height: 22, borderRadius: 4),
        ],
      ),
    );
  }
}
