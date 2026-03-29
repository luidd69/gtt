import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/journey_api.dart';
import '../../core/providers/favorites_provider.dart';
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
  _QuickAction('/metro', Icons.train_rounded, 'Metro', Color(0xFFDC2626)),
  _QuickAction('/lines', Icons.alt_route_rounded, 'Linee', Color(0xFF2563EB)),
  _QuickAction('/search', Icons.search_rounded, 'Fermate', AppColors.brand),
  _QuickAction('/nearby', Icons.near_me_rounded, 'Vicino', Color(0xFF0F766E)),
  _QuickAction(
      '/favorites', Icons.star_rounded, 'Preferiti', Color(0xFFD97706)),
  _QuickAction('/map', Icons.map_rounded, 'Mappa live', AppColors.onTime),
  _QuickAction('/reminders', Icons.notifications_rounded, 'Promemoria',
      Color(0xFFD97706)),
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
          // ─── Hero Header ─────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF1D4ED8), Color(0xFF1E40AF)],
                ),
              ),
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _greeting(),
                                  style: const TextStyle(
                                    color: Color(0xFFBFDBFE),
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                const Text(
                                  'GTT Torino',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 24,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.settings_outlined,
                                color: Colors.white70),
                            onPressed: () => context.push('/settings'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      // Search bar integrata nell'header
                      GestureDetector(
                        onTap: () => context.push('/search'),
                        child: Hero(
                          tag: 'search_bar',
                          child: AbsorbPointer(
                            child: Container(
                              decoration: BoxDecoration(
                                color: Colors.white.withAlpha(230),
                                borderRadius: BorderRadius.circular(14),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withAlpha(30),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: const TextField(
                                enabled: false,
                                decoration: InputDecoration(
                                  hintText: 'Cerca fermata, linea o luogo…',
                                  hintStyle: TextStyle(
                                    color: AppColors.text2,
                                    fontSize: 15,
                                  ),
                                  prefixIcon: Icon(Icons.search,
                                      color: AppColors.brand, size: 22),
                                  border: InputBorder.none,
                                  filled: false,
                                  contentPadding:
                                      EdgeInsets.symmetric(vertical: 14),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          // ─── Alert banner ─────────────────────────────────────────────────
          statusAsync.when(
            data: (status) {
              if (status.alerts.isEmpty)
                return const SliverToBoxAdapter(child: SizedBox.shrink());
              return SliverToBoxAdapter(
                child: GestureDetector(
                  onTap: () => context.push('/info'),
                  child: Container(
                    margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 11),
                    decoration: BoxDecoration(
                      color: AppColors.delayLightBg,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: AppColors.delayLight.withAlpha(80), width: 1),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.warning_amber_rounded,
                            color: AppColors.delayLight, size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            status.alerts.length == 1
                                ? '1 avviso di servizio attivo'
                                : '${status.alerts.length} avvisi di servizio attivi',
                            style: const TextStyle(
                              color: Color(0xFF92400E),
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                        ),
                        const Icon(Icons.chevron_right,
                            color: Color(0xFF92400E), size: 18),
                      ],
                    ),
                  ),
                ),
              );
            },
            loading: () => const SliverToBoxAdapter(child: SizedBox.shrink()),
            error: (_, __) =>
                const SliverToBoxAdapter(child: SizedBox.shrink()),
          ),
          // ─── Quick actions ────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'ACCESSO RAPIDO',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.text3,
                      letterSpacing: 0.8,
                    ),
                  ),
                  const SizedBox(height: 10),
                  GridView.count(
                    crossAxisCount: 4,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 0.9,
                    children: _quickActions
                        .map((a) => _QuickActionTile(action: a))
                        .toList(),
                  ),
                ],
              ),
            ),
          ),
          // ─── Fermate preferite ────────────────────────────────────────────
          favAsync.when(
            data: (state) {
              if (state.favorites.isEmpty)
                return const SliverToBoxAdapter(child: SizedBox.shrink());
              return _SectionSliver(
                title: 'Fermate preferite',
                stops: state.favorites,
              );
            },
            loading: () => const SliverToBoxAdapter(child: SizedBox.shrink()),
            error: (_, __) =>
                const SliverToBoxAdapter(child: SizedBox.shrink()),
          ),
          // ─── Percorsi frequenti ───────────────────────────────────────────
          favAsync.when(
            data: (state) {
              final routes = state.frequentRoutes.take(3).toList();
              if (routes.isEmpty)
                return const SliverToBoxAdapter(child: SizedBox.shrink());
              return SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 20, 16, 8),
                      child: Text(
                        'PERCORSI FREQUENTI',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.text3,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ),
                    ...routes.map((r) => Container(
                          margin: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.surface1,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                                color: AppColors.divider, width: 0.8),
                          ),
                          child: ListTile(
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 4),
                            leading: Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: AppColors.brand.withAlpha(20),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(Icons.route_rounded,
                                  color: AppColors.brand, size: 20),
                            ),
                            title: Text(
                              '${r.fromName} → ${r.toName}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 14, fontWeight: FontWeight.w600),
                            ),
                            subtitle: Text(
                              '${r.usageCount} volt${r.usageCount == 1 ? 'a' : 'e'}',
                              style: const TextStyle(
                                  fontSize: 12, color: AppColors.text3),
                            ),
                            trailing: const Icon(Icons.chevron_right,
                                color: AppColors.text3),
                            onTap: () {
                              final fromE = JourneyEndpoint(
                                  stopId: r.fromId, stopName: r.fromName);
                              final toE = JourneyEndpoint(
                                  stopId: r.toId, stopName: r.toName);
                              context.push('/journey',
                                  extra: {'from': fromE, 'to': toE});
                            },
                          ),
                        )),
                  ],
                ),
              );
            },
            loading: () => const SliverToBoxAdapter(child: SizedBox.shrink()),
            error: (_, __) =>
                const SliverToBoxAdapter(child: SizedBox.shrink()),
          ),
          // ─── Fermate vicine ───────────────────────────────────────────────
          nearbyAsync.when(
            data: (stops) {
              if (stops.isEmpty)
                return const SliverToBoxAdapter(child: SizedBox.shrink());
              return _SectionSliver(
                  title: 'VICINO A TE', stops: stops.take(5).toList());
            },
            loading: () => SliverToBoxAdapter(
              child: Column(
                children: List.generate(3, (_) => const StopCardSkeleton()),
              ),
            ),
            error: (_, __) =>
                const SliverToBoxAdapter(child: SizedBox.shrink()),
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
      onTap: () => context.push(action.route),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface1,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.divider, width: 0.8),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: action.color.withAlpha(22),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(action.icon, color: action.color, size: 22),
            ),
            const SizedBox(height: 6),
            Text(
              action.label,
              style: const TextStyle(
                color: AppColors.text1,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
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
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.text3,
                letterSpacing: 0.8,
              ),
            ),
          ),
          ...stops.map((s) => StopCard(
                stop: s,
                onTap: () =>
                    context.push('/stops/${Uri.encodeComponent(s.stopId)}'),
              )),
        ],
      ),
    );
  }
}
