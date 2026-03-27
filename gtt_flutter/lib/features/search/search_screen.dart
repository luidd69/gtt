import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/providers/favorites_provider.dart';
import '../../core/providers/location_provider.dart';
import '../../widgets/bottom_nav.dart';
import '../../widgets/stop_card.dart';
import '../../widgets/loading_shimmer.dart';
import '../../core/theme/colors.dart';
import 'search_provider.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _ctrl = TextEditingController();
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focus.requestFocus();
      // Fetch location for nearby
      ref.read(locationProvider.notifier).fetch();
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final searchState = ref.watch(searchProvider).valueOrNull ?? const SearchState();
    final locState = ref.watch(locationProvider).valueOrNull;

    return Scaffold(
      appBar: AppBar(
        title: Hero(
          tag: 'search_bar',
          child: Material(
            color: Colors.transparent,
            child: TextField(
              controller: _ctrl,
              focusNode: _focus,
              autofocus: true,
              decoration: InputDecoration(
                hintText: 'Cerca fermata o linea…',
                prefixIcon: const Icon(Icons.search, color: AppColors.text3),
                suffixIcon: _ctrl.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, color: AppColors.text3),
                        onPressed: () {
                          _ctrl.clear();
                          ref.read(searchProvider.notifier).onQueryChanged('');
                        },
                      )
                    : null,
                hintStyle: const TextStyle(color: AppColors.text3),
              ),
              onChanged: (q) {
                setState(() {});
                ref.read(searchProvider.notifier).onQueryChanged(q);
              },
            ),
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/home'),
        ),
      ),
      body: _buildBody(context, searchState, locState),
      bottomNavigationBar: const BottomNav(currentIndex: 1),
    );
  }

  Widget _buildBody(BuildContext context, SearchState searchState, dynamic locState) {
    if (searchState.loading) {
      return ListView(
        children: List.generate(5, (_) => const StopCardSkeleton()),
      );
    }

    if (searchState.error != null) {
      return _ErrorView(message: searchState.error!);
    }

    if (searchState.query.length >= 2) {
      if (searchState.results.isEmpty) {
        return const _EmptyView(message: 'Nessuna fermata trovata');
      }
      return _ResultsList(results: searchState.results);
    }

    // Empty query — mostra nearby o recenti
    return _IdleView(locState: locState);
  }
}

class _ResultsList extends ConsumerWidget {
  final List results;
  const _ResultsList({required this.results});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final favAsync = ref.watch(favoritesProvider);
    return ListView.builder(
      itemCount: results.length,
      itemBuilder: (_, i) {
        final stop = results[i];
        final isFav = favAsync.valueOrNull?.favorites.any((f) => f.stopId == stop.stopId) ?? false;
        return StopCard(
          stop: stop,
          isFavorite: isFav,
          onTap: () {
            ref.read(favoritesProvider.notifier).addRecent(stop);
            context.push('/stops/${stop.stopId}');
          },
          onFavoriteTap: () => ref.read(favoritesProvider.notifier).toggle(stop),
        );
      },
    );
  }
}

class _IdleView extends ConsumerWidget {
  final dynamic locState;
  const _IdleView({this.locState});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recentStops = ref.watch(favoritesProvider).valueOrNull?.recentStops ?? [];

    final coords = (locState?.hasLocation == true)
        ? (locState!.lat! as double, locState!.lon! as double)
        : null;

    final nearbyAsync = coords != null
        ? ref.watch(nearbyStopsSearchProvider(coords))
        : null;

    return ListView(
      children: [
        if (recentStops.isNotEmpty) ...[
          _SectionHeader('Recenti'),
          ...recentStops.take(5).map((s) => StopCard(
                stop: s,
                onTap: () => context.push('/stops/${s.stopId}'),
              )),
        ],
        if (nearbyAsync != null) ...[
          _SectionHeader('Vicino a te'),
          nearbyAsync.when(
            data: (stops) => Column(
              children: stops
                  .take(5)
                  .map((s) => StopCard(stop: s, onTap: () => context.push('/stops/${s.stopId}')))
                  .toList(),
            ),
            loading: () => Column(
              children: List.generate(3, (_) => const StopCardSkeleton()),
            ),
            error: (_, __) => const SizedBox.shrink(),
          ),
        ],
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader(this.title);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: Text(
          title,
          style: Theme.of(context)
              .textTheme
              .titleSmall
              ?.copyWith(fontWeight: FontWeight.w700, color: AppColors.text2),
        ),
      );
}

class _EmptyView extends StatelessWidget {
  final String message;
  const _EmptyView({required this.message});

  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.search_off, size: 48, color: AppColors.text3),
            const SizedBox(height: 12),
            Text(message, style: const TextStyle(color: AppColors.text3)),
          ],
        ),
      );
}

class _ErrorView extends StatelessWidget {
  final String message;
  const _ErrorView({required this.message});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: AppColors.delayHeavy),
              const SizedBox(height: 12),
              Text(message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.text2)),
            ],
          ),
        ),
      );
}
