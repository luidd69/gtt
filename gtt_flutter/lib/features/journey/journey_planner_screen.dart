import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/journey_api.dart';
import '../../core/api/stops_api.dart';
import '../../core/models/itinerary.dart';
import '../../core/models/leg.dart';
import '../../core/providers/favorites_provider.dart';
import '../../core/providers/location_provider.dart';
import '../../core/theme/colors.dart';
import '../../widgets/bottom_nav.dart';
import '../../widgets/loading_shimmer.dart';
import '../../widgets/route_chip.dart';
import 'journey_provider.dart';

class JourneyPlannerScreen extends ConsumerStatefulWidget {
  const JourneyPlannerScreen({super.key});

  @override
  ConsumerState<JourneyPlannerScreen> createState() =>
      _JourneyPlannerScreenState();
}

class _JourneyPlannerScreenState extends ConsumerState<JourneyPlannerScreen> {
  @override
  Widget build(BuildContext context) {
    final planState =
        ref.watch(journeyPlanProvider).valueOrNull ?? const JourneyPlanState();

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.brand,
        foregroundColor: Colors.white,
        title: const Text('Pianifica tragitto',
            style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: Column(
        children: [
          _EndpointSection(state: planState),
          const Divider(height: 1),
          Expanded(
            child: planState.loading
                ? ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    children: List.generate(
                      4,
                      (_) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: LoadingShimmer.card(),
                      ),
                    ),
                  )
                : planState.error != null
                    ? _ErrorView(message: planState.error!)
                    : planState.results.isEmpty
                        ? _emptyHint(planState)
                        : Column(
                            children: [
                              if (planState.source != null)
                                _ResultsBanner(state: planState),
                              Expanded(
                                child: _ItineraryList(
                                    itineraries: planState.results),
                              ),
                            ],
                          ),
          ),
        ],
      ),
      bottomNavigationBar: const BottomNav(currentIndex: 2),
    );
  }

  Widget _emptyHint(JourneyPlanState state) {
    if (!state.canSearch) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.route_outlined, size: 56, color: AppColors.text3),
            SizedBox(height: 12),
            Text(
              'Seleziona partenza e arrivo',
              style: TextStyle(color: AppColors.text3, fontSize: 15),
            ),
          ],
        ),
      );
    }
    return const Center(
      child: Text('Nessun tragitto trovato',
          style: TextStyle(color: AppColors.text3)),
    );
  }
}

class _EndpointSection extends ConsumerWidget {
  final JourneyPlanState state;
  const _EndpointSection({required this.state});

  Future<void> _pickTime(BuildContext context, WidgetRef ref) async {
    final now = TimeOfDay.now();
    final picked = await showTimePicker(
      context: context,
      initialTime: now,
      helpText: 'Arriva entro orario',
    );
    if (picked != null) {
      final hh = picked.hour.toString().padLeft(2, '0');
      final mm = picked.minute.toString().padLeft(2, '0');
      ref.read(journeyPlanProvider.notifier).setArriveByTime('$hh:$mm');
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              const Icon(Icons.my_location, color: AppColors.brand, size: 20),
              Container(width: 2, height: 28, color: AppColors.divider),
              const Icon(Icons.location_on, color: Color(0xFFE8431B), size: 20),
            ],
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              children: [
                _StopPickerField(
                  label: 'Partenza',
                  selected: state.from,
                  onPick: (e) =>
                      ref.read(journeyPlanProvider.notifier).setFrom(e),
                ),
                const SizedBox(height: 8),
                _StopPickerField(
                  label: 'Arrivo',
                  selected: state.to,
                  onPick: (e) =>
                      ref.read(journeyPlanProvider.notifier).setTo(e),
                ),
                const SizedBox(height: 10),
                // ArriveBy toggle
                Row(
                  children: [
                    const Icon(Icons.schedule, size: 16, color: AppColors.text3),
                    const SizedBox(width: 6),
                    GestureDetector(
                      onTap: () => ref
                          .read(journeyPlanProvider.notifier)
                          .setArriveByMode(!state.arriveByMode),
                      child: Text(
                        state.arriveByMode ? 'Arriva entro' : 'Parti adesso',
                        style: TextStyle(
                          fontSize: 13,
                          color: state.arriveByMode
                              ? AppColors.brand
                              : AppColors.text2,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    if (state.arriveByMode) ...[
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: () => _pickTime(context, ref),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.brand.withAlpha(20),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            state.arriveByTime ?? 'Scegli ora',
                            style: const TextStyle(
                              color: AppColors.brand,
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ),
                    ],
                    const Spacer(),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    OutlinedButton.icon(
                      onPressed: () =>
                          ref.read(journeyPlanProvider.notifier).swap(),
                      icon: const Icon(Icons.swap_vert, size: 18),
                      label: const Text('Inverti'),
                      style: OutlinedButton.styleFrom(
                        visualDensity: VisualDensity.compact,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: state.canSearch
                            ? () async {
                                await ref
                                    .read(journeyPlanProvider.notifier)
                                    .search();
                                // Salva percorso frequente
                                final s = ref
                                    .read(journeyPlanProvider)
                                    .valueOrNull;
                                if (s != null &&
                                    s.from?.stopId != null &&
                                    s.to?.stopId != null) {
                                  ref
                                      .read(favoritesProvider.notifier)
                                      .trackRoute(
                                        fromId: s.from!.stopId!,
                                        fromName: s.from!.stopName ?? '',
                                        toId: s.to!.stopId!,
                                        toName: s.to!.stopName ?? '',
                                      );
                                }
                              }
                            : null,
                        icon: const Icon(Icons.search, size: 18),
                        label: const Text('Cerca'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StopPickerField extends ConsumerStatefulWidget {
  final String label;
  final JourneyEndpoint? selected;
  final ValueChanged<JourneyEndpoint?> onPick;

  const _StopPickerField({
    required this.label,
    this.selected,
    required this.onPick,
  });

  @override
  ConsumerState<_StopPickerField> createState() => _StopPickerFieldState();
}

class _StopPickerFieldState extends ConsumerState<_StopPickerField> {
  late TextEditingController _ctrl;
  final FocusNode _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.selected?.stopName ?? '');
  }

  @override
  void didUpdateWidget(_StopPickerField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.selected?.stopName != oldWidget.selected?.stopName) {
      _ctrl.text = widget.selected?.stopName ?? '';
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Autocomplete<JourneyEndpoint>(
      displayStringForOption: (e) => e.stopName ?? '',
      optionsBuilder: (value) async {
        final locState = ref.read(locationProvider).valueOrNull;
        final gpsOption = locState?.hasLocation == true
            ? [
                JourneyEndpoint(
                  stopName: '📍 La mia posizione',
                  lat: locState!.lat,
                  lon: locState.lon,
                )
              ]
            : const <JourneyEndpoint>[];
        if (value.text.length < 2) return gpsOption;
        try {
          final stops = await ref.read(stopsApiProvider).search(value.text);
          final places = value.text.length >= 3
              ? await ref.read(stopsApiProvider).searchPlaces(value.text)
              : const <PlaceResult>[];

          final stopEndpoints = stops
              .map(
                (s) => JourneyEndpoint(
                  stopId: s.stopId,
                  stopName: s.stopName,
                ),
              )
              .toList();
          final placeEndpoints = places
              .map(
                (p) => JourneyEndpoint(
                  stopName: p.name,
                  lat: p.lat,
                  lon: p.lon,
                ),
              )
              .toList();

          return [...gpsOption, ...stopEndpoints, ...placeEndpoints];
        } catch (_) {
          return gpsOption;
        }
      },
      onSelected: (endpoint) {
        widget.onPick(endpoint);
        // Chiude la tastiera e rimuove il focus
        _focusNode.unfocus();
        FocusManager.instance.primaryFocus?.unfocus();
      },
      optionsViewBuilder: (context, onSelected, options) => Align(
        alignment: Alignment.topLeft,
        child: Material(
          elevation: 6,
          borderRadius: BorderRadius.circular(8),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 260, minWidth: 280),
            child: ListView.builder(
              padding: EdgeInsets.zero,
              shrinkWrap: true,
              itemCount: options.length,
              itemBuilder: (_, i) {
                final e = options.elementAt(i);
                final isGps = e.stopName?.startsWith('📍') ?? false;
                final isPlace = e.stopId == null && !isGps;
                return InkWell(
                  onTap: () => onSelected(e),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    child: Row(
                      children: [
                        Icon(
                          isGps
                              ? Icons.my_location
                              : isPlace
                                  ? Icons.place_outlined
                                  : Icons.directions_bus_outlined,
                          size: 18,
                          color: isGps || !isPlace
                              ? AppColors.brand
                              : AppColors.onTime,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                e.stopName ?? '',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: 14, color: AppColors.text1),
                              ),
                              Text(
                                isGps
                                    ? 'Posizione attuale GPS'
                                    : isPlace
                                        ? 'Luogo'
                                        : 'Fermata ${e.stopId ?? ''}',
                                style: const TextStyle(
                                    fontSize: 12, color: AppColors.text3),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ),
      fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
        return TextField(
          controller: controller,
          focusNode: focusNode,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) {
            focusNode.unfocus();
            FocusManager.instance.primaryFocus?.unfocus();
          },
          decoration: InputDecoration(
            labelText: widget.label,
            prefixIcon: Icon(
              widget.label == 'Partenza'
                  ? Icons.my_location
                  : Icons.location_on,
              size: 18,
            ),
            suffixIcon: controller.text.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear, size: 16),
                    onPressed: () {
                      controller.clear();
                      widget.onPick(null);
                    },
                  )
                : null,
          ),
        );
      },
    );
  }
}

class _ResultsBanner extends StatelessWidget {
  final JourneyPlanState state;
  const _ResultsBanner({required this.state});

  @override
  Widget build(BuildContext context) {
    final source = state.source ?? '';
    final isFallback = state.fallback;
    final solutions = state.solutions;
    final total = solutions?.values.fold<int>(0, (a, b) => a + b) ?? state.results.length;
    final bg = isFallback ? const Color(0xFFFEF3C7) : const Color(0xFFECFDF5);
    final fg = isFallback ? const Color(0xFF92400E) : const Color(0xFF065F46);
    final icon = isFallback ? Icons.warning_amber_rounded : Icons.check_circle_outline;
    final label = isFallback
        ? 'Percorso indicativo · dati parziali'
        : '$total ${total == 1 ? 'soluzione' : 'soluzioni'} · ${source == 'otp' ? 'OpenTripPlanner' : source == 'gtfs' ? 'Orari GTFS' : source}';
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
      child: Row(
        children: [
          Icon(icon, size: 16, color: fg),
          const SizedBox(width: 8),
          Expanded(
            child: Text(label,
                style: TextStyle(
                    fontSize: 12, color: fg, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}

class _ItineraryList extends StatelessWidget {
  final List<Itinerary> itineraries;
  const _ItineraryList({required this.itineraries});

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: itineraries.length,
      itemBuilder: (_, i) => _ItineraryCard(
        itinerary: itineraries[i],
        onTap: () => context.push('/journey/itinerary', extra: itineraries[i]),
      ),
    );
  }
}

class _ItineraryCard extends StatelessWidget {
  final Itinerary itinerary;
  final VoidCallback onTap;

  const _ItineraryCard({required this.itinerary, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final it = itinerary;
    final hasRealtime = it.legs.any((l) => l.isTransit && l.realtime);
    final totalStops = it.legs
        .where((l) => l.isTransit)
        .fold<int>(0, (sum, l) => sum + l.intermediateStops.length);

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
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Riga orari + badge
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      it.departureTime,
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 20),
                    ),
                    Text(
                      'arr. ${it.arrivalTime}',
                      style: const TextStyle(
                          color: AppColors.text3, fontSize: 12),
                    ),
                  ],
                ),
                const Spacer(),
                Wrap(
                  spacing: 4,
                  children: [
                    if (it.fastest)
                      _Badge('Più veloce', AppColors.brand, Colors.white),
                    if (it.fewestTransfers)
                      _Badge('Meno cambi', AppColors.onTime, Colors.white),
                    if (hasRealtime)
                      _Badge('RT', const Color(0xFFDCFCE7),
                          const Color(0xFF166534)),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 6),
            // Riga info: durata · cambi · fermate
            Row(
              children: [
                Text(
                  '${it.durationMinutes} min',
                  style: const TextStyle(
                      color: AppColors.text2,
                      fontSize: 13,
                      fontWeight: FontWeight.w600),
                ),
                const SizedBox(width: 6),
                Text(
                  it.transfers == 0
                      ? 'Diretto'
                      : '${it.transfers} cambio${it.transfers > 1 ? 'i' : ''}',
                  style: const TextStyle(color: AppColors.text3, fontSize: 13),
                ),
                if (totalStops > 0) ...[
                  const SizedBox(width: 6),
                  Text(
                    '· $totalStops fermate',
                    style: const TextStyle(
                        color: AppColors.text3, fontSize: 13),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 10),
            // Leg strip: camminata + mezzi
            _LegStrip(legs: it.legs),
          ],
        ),
      ),
    );
  }
}

class _LegStrip extends StatelessWidget {
  final List<Leg> legs;
  const _LegStrip({required this.legs});

  @override
  Widget build(BuildContext context) {
    final visibleWidgets = <Widget>[];
    for (final leg in legs) {
      if (leg.isTransit) {
        visibleWidgets.add(RouteChip(
          shortName: leg.routeShortName ?? '?',
          color: leg.routeColor,
          textColor: leg.routeTextColor,
        ));
      } else if (leg.isWalk) {
        final walkMin = (leg.durationSeconds / 60).ceil();
        if (walkMin > 0) {
          visibleWidgets.add(_WalkChip(minutes: walkMin));
        }
      }
    }
    final children = <Widget>[];
    for (int i = 0; i < visibleWidgets.length; i++) {
      children.add(visibleWidgets[i]);
      if (i < visibleWidgets.length - 1) {
        children.add(const Icon(Icons.chevron_right,
            size: 14, color: AppColors.text3));
      }
    }
    return Wrap(
      spacing: 2,
      runSpacing: 4,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: children,
    );
  }
}

class _WalkChip extends StatelessWidget {
  final int minutes;
  const _WalkChip({required this.minutes});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
        decoration: BoxDecoration(
          color: AppColors.surface3,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: AppColors.divider),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.directions_walk, size: 12, color: AppColors.text2),
            const SizedBox(width: 2),
            Text(
              '${minutes}m',
              style: const TextStyle(fontSize: 11, color: AppColors.text2),
            ),
          ],
        ),
      );
}

class _Badge extends StatelessWidget {
  final String label;
  final Color bg;
  final Color fg;
  const _Badge(this.label, this.bg, this.fg);

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(left: 4),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration:
            BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
        child: Text(label,
            style: TextStyle(
                color: fg, fontSize: 10, fontWeight: FontWeight.w700)),
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
