import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/providers/favorites_provider.dart';
import '../../core/providers/location_provider.dart';
import '../../widgets/bottom_nav.dart';
import '../../widgets/stop_card.dart';
import '../../widgets/loading_shimmer.dart';
import '../../core/theme/colors.dart';
import '../../core/models/stop.dart';
import 'home_provider.dart';

String _greeting() {
  final h = DateTime.now().hour;
  if (h >= 5 && h < 12) return 'Buongiorno';
  if (h >= 12 && h < 18) return 'Buon pomeriggio';
  return 'Buona sera';
}

class _QuickAction {
  final String route;
  final IconData icon;
  final String label;
  final Color color;
  const _QuickAction(this.route, this.icon, this.label, this.color);
}

const _quickActions = [
  _QuickAction('/journey', Icons.route_rounded, 'Tragitto', Color(0xFFE8431B)),
  _QuickAction('/search', Icons.search_rounded, 'Fermate', AppColors.brand),
  _QuickAction('/map', Icons.map_rounded, 'Mappa live', AppColors.onTime),
  _QuickAction('/reminders', Icons.notifications_rounded, 'Promemoria', Color(0xFFD97706)),
];

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statusAsync = ref.watch(serviceStatusHomeProvider);
    final favAsync = ref.watch(favoritesProvider);
    final nearbyAsync = ref.watch(nearbyStopsHomeProvider);

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            floating: true,
            snap: true,
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _greeting(),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.text3,
                      ),
                ),
                const Text(
                  'GTT Torino',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20),
                ),
              ],
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.settings_outlined),
                onPressed: () => context.push('/settings'),
              ),
            ],
          ),
          // Alert banner
          statusAsync.when(
            data: (status) {
              if (status.alerts.isEmpty) return const SliverToBoxAdapter(child: SizedBox.shrink());
              return SliverToBoxAdapter(
                child: GestureDetector(
                  onTap: () => context.go('/info'),
                  child: Container(
                    margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        const Text('⚠️', style: TextStyle(fontSize: 18)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            status.alerts.length == 1
                                ? '1 avviso attivo'
                                : '${status.alerts.length} avvisi attivi',
                            style: const TextStyle(
                              color: Color(0xFF92400E),
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        const Icon(Icons.chevron_right, color: Color(0xFF92400E), size: 18),
                      ],
                    ),
                  ),
                ),
              );
            },
            loading: () => const SliverToBoxAdapter(child: SizedBox.shrink()),
            error: (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
          ),
          // Hero search bar
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: GestureDetector(
                onTap: () => context.go('/search'),
                child: Hero(
                  tag: 'search_bar',
                  child: AbsorbPointer(
                    child: TextField(
                      decoration: InputDecoration(
                        hintText: 'Cerca fermata o linea…',
                        prefixIcon: const Icon(Icons.search, color: AppColors.text3),
                        hintStyle: const TextStyle(color: AppColors.text3),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: AppColors.divider),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          // Quick actions grid
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Azioni rapide',
                    style: Theme.of(context)
                        .textTheme
                        .titleSmall
                        ?.copyWith(fontWeight: FontWeight.w700, color: AppColors.text2),
                  ),
                  const SizedBox(height: 10),
                  GridView.count(
                    crossAxisCount: 4,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 8,
                    crossAxisSpacing: 8,
                    children: _quickActions.map((a) => _QuickActionTile(action: a)).toList(),
                  ),
                ],
              ),
            ),
          ),
          // Fermate preferite
          favAsync.when(
            data: (state) {
              if (state.favorites.isEmpty) return const SliverToBoxAdapter(child: SizedBox.shrink());
              return _SectionSliver(
                title: 'Fermate preferite',
                stops: state.favorites,
              );
            },
            loading: () => const SliverToBoxAdapter(child: SizedBox.shrink()),
            error: (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
          ),
          // Fermate vicine
          nearbyAsync.when(
            data: (stops) {
              if (stops.isEmpty) return const SliverToBoxAdapter(child: SizedBox.shrink());
              return _SectionSliver(title: 'Vicino a te', stops: stops.take(5).toList());
            },
            loading: () => SliverToBoxAdapter(
              child: Column(
                children: List.generate(3, (_) => const StopCardSkeleton()),
              ),
            ),
            error: (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 80)),
        ],
      ),
      bottomNavigationBar: const BottomNav(currentIndex: 0),
    );
  }
}

class _QuickActionTile extends StatelessWidget {
  final _QuickAction action;
  const _QuickActionTile({required this.action});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go(action.route),
      child: Container(
        decoration: BoxDecoration(
          color: action.color.withAlpha(20),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(action.icon, color: action.color, size: 26),
            const SizedBox(height: 4),
            Text(
              action.label,
              style: TextStyle(
                color: action.color,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionSliver extends StatelessWidget {
  final String title;
  final List<Stop> stops;
  const _SectionSliver({required this.title, required this.stops});

  @override
  Widget build(BuildContext context) {
    return SliverToBoxAdapter(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text(
              title,
              style: Theme.of(context)
                  .textTheme
                  .titleSmall
                  ?.copyWith(fontWeight: FontWeight.w700, color: AppColors.text2),
            ),
          ),
          ...stops.map((s) => StopCard(
                stop: s,
                onTap: () => context.push('/stops/${s.stopId}'),
              )),
        ],
      ),
    );
  }
}
