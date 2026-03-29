import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/lines_api.dart';
import '../../core/models/route_line.dart';
import '../../core/providers/favorites_provider.dart';
import '../../core/providers/location_provider.dart';
import '../../widgets/bottom_nav.dart';
import '../../widgets/route_chip.dart';
import '../../widgets/stop_card.dart';
import '../../widgets/loading_shimmer.dart';
import '../../core/theme/colors.dart';
import 'search_provider.dart';

// Provider per ricerca linee con filtro tipo
final _linesSearchProvider =
    FutureProvider.autoDispose.family<List<RouteLine>, ({String q, int? type})>(
  (ref, args) => ref.watch(linesApiProvider).getAll(type: args.type).then(
        (lines) => lines
            .where((l) =>
                l.shortName.toLowerCase().contains(args.q.toLowerCase()) ||
                l.longName.toLowerCase().contains(args.q.toLowerCase()))
            .toList(),
      ),
);

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen>
    with SingleTickerProviderStateMixin {
  final _ctrl = TextEditingController();
  final _focus = FocusNode();
  late final TabController _tabCtrl;
  int? _lineTypeFilter; // null=Tutte, 1=Metro, 0=Tram, 3=Bus

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focus.requestFocus();
      ref.read(locationProvider.notifier).fetch();
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _focus.dispose();
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final searchState =
        ref.watch(searchProvider).valueOrNull ?? const SearchState();
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
                          setState(() {});
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
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/home'),
        ),
        bottom: TabBar(
          controller: _tabCtrl,
          tabs: const [
            Tab(icon: Icon(Icons.directions_bus_outlined, size: 18), text: 'Fermate'),
            Tab(icon: Icon(Icons.alt_route_outlined, size: 18), text: 'Linee'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabCtrl,
        children: [
          // Tab Fermate
          _buildStopsTab(context, searchState, locState),
          // Tab Linee
          _buildLinesTab(context, searchState.query),
        ],
      ),
      bottomNavigationBar: const BottomNav(currentIndex: 1),
    );
  }

  Widget _buildStopsTab(
      BuildContext context, SearchState searchState, dynamic locState) {
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
    return _IdleView(locState: locState);
  }

  Widget _buildLinesTab(BuildContext context, String query) {
    return Column(
      children: [
        // Filtro tipo
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _TypeChip(label: 'Tutte', selected: _lineTypeFilter == null,
                    onTap: () => setState(() => _lineTypeFilter = null)),
                const SizedBox(width: 6),
                _TypeChip(label: '🚇 Metro', selected: _lineTypeFilter == 1,
                    onTap: () => setState(() => _lineTypeFilter = 1)),
                const SizedBox(width: 6),
                _TypeChip(label: '🚃 Tram', selected: _lineTypeFilter == 0,
                    onTap: () => setState(() => _lineTypeFilter = 0)),
                const SizedBox(width: 6),
                _TypeChip(label: '🚌 Bus', selected: _lineTypeFilter == 3,
                    onTap: () => setState(() => _lineTypeFilter = 3)),
              ],
            ),
          ),
        ),
        Expanded(
          child: query.length < 2
              ? _LinesAllList(typeFilter: _lineTypeFilter)
              : _LinesSearchResults(q: query, typeFilter: _lineTypeFilter),
        ),
      ],
    );
  }
}

// ----- Lines Tab Widgets -----

class _TypeChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _TypeChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: selected ? AppColors.brand : AppColors.brand.withAlpha(20),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: selected ? Colors.white : AppColors.brand,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
        ),
      );
}

class _LinesAllList extends ConsumerWidget {
  final int? typeFilter;
  const _LinesAllList({this.typeFilter});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final linesAsync = ref.watch(
      FutureProvider.autoDispose<List<RouteLine>>(
        (ref) => ref.watch(linesApiProvider).getAll(type: typeFilter),
      ),
    );
    return linesAsync.when(
      data: (lines) => _LineListView(lines: lines),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Errore: $e')),
    );
  }
}

class _LinesSearchResults extends ConsumerWidget {
  final String q;
  final int? typeFilter;
  const _LinesSearchResults({required this.q, this.typeFilter});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final linesAsync =
        ref.watch(_linesSearchProvider((q: q, type: typeFilter)));
    return linesAsync.when(
      data: (lines) => lines.isEmpty
          ? const _EmptyView(message: 'Nessuna linea trovata')
          : _LineListView(lines: lines),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Errore: $e')),
    );
  }
}

class _LineListView extends StatelessWidget {
  final List<RouteLine> lines;
  const _LineListView({required this.lines});

  @override
  Widget build(BuildContext context) => ListView.builder(
        itemCount: lines.length,
        itemBuilder: (_, i) {
          final l = lines[i];
          return ListTile(
            leading: RouteChip(
              shortName: l.shortName,
              color: l.color,
              textColor: l.textColor,
            ),
            title: Text(l.longName,
                maxLines: 1, overflow: TextOverflow.ellipsis),
            subtitle: Text(_typeLabel(l.routeType)),
            trailing: const Icon(Icons.chevron_right),
            onTap: () =>
                context.push('/lines/${Uri.encodeComponent(l.routeId)}'),
          );
        },
      );

  String _typeLabel(int type) {
    switch (type) {
      case 1:
        return 'Metro';
      case 0:
        return 'Tram';
      default:
        return 'Bus';
    }
  }
}

// ----- Stops Tab Widgets -----

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
        final isFav = favAsync.valueOrNull?.favorites
                .any((f) => f.stopId == stop.stopId) ??
            false;
        return StopCard(
          stop: stop,
          isFavorite: isFav,
          onTap: () {
            ref.read(favoritesProvider.notifier).addRecent(stop);
            context.push('/stops/${Uri.encodeComponent(stop.stopId)}');
          },
          onFavoriteTap: () =>
              ref.read(favoritesProvider.notifier).toggle(stop),
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
    final recentStops =
        ref.watch(favoritesProvider).valueOrNull?.recentStops ?? [];

    final coords = (locState?.hasLocation == true)
        ? (locState!.lat! as double, locState!.lon! as double)
        : null;

    final nearbyAsync =
        coords != null ? ref.watch(nearbyStopsSearchProvider(coords)) : null;

    return ListView(
      children: [
        if (recentStops.isNotEmpty) ...[
          _SectionHeader('Recenti'),
          ...recentStops.take(5).map((s) => StopCard(
                stop: s,
                onTap: () =>
                    context.push('/stops/${Uri.encodeComponent(s.stopId)}'),
              )),
        ],
        if (nearbyAsync != null) ...[
          _SectionHeader('Vicino a te'),
          nearbyAsync.when(
            data: (stops) => Column(
              children: stops
                  .take(5)
                  .map((s) => StopCard(
                        stop: s,
                        onTap: () => context
                            .push('/stops/${Uri.encodeComponent(s.stopId)}'),
                      ))
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
              const Icon(Icons.error_outline,
                  size: 48, color: AppColors.delayHeavy),
              const SizedBox(height: 12),
              Text(message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.text2)),
            ],
          ),
        ),
      );
}
