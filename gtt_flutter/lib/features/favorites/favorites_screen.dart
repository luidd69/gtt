import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/providers/favorites_provider.dart';
import '../../core/api/journey_api.dart';
import '../../core/theme/colors.dart';
import '../../widgets/route_chip.dart';
import '../../widgets/stop_card.dart';

class FavoritesScreen extends ConsumerWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final favAsync = ref.watch(favoritesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Preferiti')),
      body: favAsync.when(
        data: (data) {
          final hasAny = data.favorites.isNotEmpty ||
              data.favoriteLines.isNotEmpty ||
              data.frequentRoutes.isNotEmpty;
          if (!hasAny) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.star_border_rounded,
                      size: 56, color: AppColors.text3),
                  const SizedBox(height: 12),
                  const Text('Nessun preferito ancora',
                      style: TextStyle(color: AppColors.text2, fontSize: 16)),
                  const SizedBox(height: 8),
                  TextButton.icon(
                    onPressed: () => context.push('/search'),
                    icon: const Icon(Icons.search),
                    label: const Text('Cerca fermate e linee'),
                  ),
                ],
              ),
            );
          }
          return ListView(
            children: [
              // Percorsi frequenti
              if (data.frequentRoutes.isNotEmpty) ...[
                _Header('Percorsi frequenti'),
                ...data.frequentRoutes.map(
                  (r) => _FrequentRouteCard(
                    route: r,
                    onTap: () {
                      final fromEndpoint = JourneyEndpoint(
                          stopId: r.fromId, stopName: r.fromName);
                      final toEndpoint =
                          JourneyEndpoint(stopId: r.toId, stopName: r.toName);
                      context.push('/journey',
                          extra: {'from': fromEndpoint, 'to': toEndpoint});
                    },
                  ),
                ),
              ],
              // Fermate preferite
              if (data.favorites.isNotEmpty) ...[
                _Header('Fermate preferite'),
                ...data.favorites.map(
                  (s) => StopCard(
                    stop: s,
                    isFavorite: true,
                    onTap: () =>
                        context.push('/stops/${Uri.encodeComponent(s.stopId)}'),
                    onFavoriteTap: () =>
                        ref.read(favoritesProvider.notifier).toggle(s),
                  ),
                ),
              ],
              // Linee preferite
              if (data.favoriteLines.isNotEmpty) ...[
                _Header('Linee preferite'),
                ...data.favoriteLines.map(
                  (l) => ListTile(
                    leading: RouteChip(
                      shortName: l.shortName,
                      color: l.color,
                      textColor: l.textColor,
                    ),
                    title: Text(l.longName,
                        maxLines: 1, overflow: TextOverflow.ellipsis),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.star_rounded,
                              color: Colors.amber, size: 22),
                          onPressed: () =>
                              ref.read(favoritesProvider.notifier).toggleLine(l),
                          tooltip: 'Rimuovi dai preferiti',
                        ),
                        const Icon(Icons.chevron_right),
                      ],
                    ),
                    onTap: () => context
                        .push('/lines/${Uri.encodeComponent(l.routeId)}'),
                  ),
                ),
              ],
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

class _Header extends StatelessWidget {
  final String text;
  const _Header(this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: Text(text,
            style: Theme.of(context)
                .textTheme
                .titleSmall
                ?.copyWith(fontWeight: FontWeight.w700, color: AppColors.text2)),
      );
}

class _FrequentRouteCard extends StatelessWidget {
  final FrequentRoute route;
  final VoidCallback onTap;
  const _FrequentRouteCard({required this.route, required this.onTap});

  @override
  Widget build(BuildContext context) => ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.brand.withAlpha(20),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.route_rounded, color: AppColors.brand, size: 22),
        ),
        title: Text(
          '${route.fromName} → ${route.toName}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text('Usato ${route.usageCount} volt${route.usageCount == 1 ? 'a' : 'e'}'),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      );
}
