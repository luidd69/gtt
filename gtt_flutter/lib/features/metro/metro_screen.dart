import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/journey_api.dart';
import '../../core/api/service_api.dart';
import '../../core/models/stop.dart';
import '../../core/theme/colors.dart';
import '../../widgets/route_chip.dart';

final _metroInfoProvider = FutureProvider.autoDispose<Map<String, dynamic>>(
  (ref) => ref.watch(serviceApiProvider).getMetroInfo(),
);

class MetroScreen extends ConsumerStatefulWidget {
  const MetroScreen({super.key});

  @override
  ConsumerState<MetroScreen> createState() => _MetroScreenState();
}

class _MetroScreenState extends ConsumerState<MetroScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tab;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Metro realtime'),
        bottom: TabBar(
          controller: _tab,
          tabs: const [
            Tab(icon: Icon(Icons.train_rounded, size: 18), text: 'Linea'),
            Tab(icon: Icon(Icons.route_rounded, size: 18), text: 'Percorso'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tab,
        children: const [
          _MetroLineTab(),
          _MetroPlannerTab(),
        ],
      ),
    );
  }
}

// ─── Tab Linea ────────────────────────────────────────────────────────────────

class _MetroLineTab extends ConsumerWidget {
  const _MetroLineTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final infoAsync = ref.watch(_metroInfoProvider);
    return infoAsync.when(
      data: (data) {
        final routes =
            (data['routes'] as List? ?? const []).cast<Map<String, dynamic>>();
        if (routes.isEmpty) {
          return const Center(child: Text('Dati metro non disponibili'));
        }
        return ListView.builder(
          padding: const EdgeInsets.symmetric(vertical: 8),
          itemCount: routes.length,
          itemBuilder: (_, i) => _MetroRouteSection(route: routes[i]),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Errore: $e')),
    );
  }
}

class _MetroRouteSection extends StatefulWidget {
  final Map<String, dynamic> route;
  const _MetroRouteSection({required this.route});

  @override
  State<_MetroRouteSection> createState() => _MetroRouteSectionState();
}

class _MetroRouteSectionState extends State<_MetroRouteSection> {
  bool _expanded = true;

  @override
  Widget build(BuildContext context) {
    final name = widget.route['name']?.toString() ?? 'Linea Metro';
    final color = widget.route['color']?.toString();
    final routeId = widget.route['routeId']?.toString() ?? '';
    final directions = (widget.route['directions'] as List? ?? const [])
        .cast<Map<String, dynamic>>();

    Color lineColor = AppColors.brand;
    if (color != null && color.length == 6) {
      try {
        lineColor = Color(int.parse('FF$color', radix: 16));
      } catch (_) {}
    }

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Column(
        children: [
          ListTile(
            leading: RouteChip(
              shortName: routeId.isNotEmpty ? routeId : 'M1',
              color: color,
              textColor: 'FFFFFF',
            ),
            title: Text(name,
                style: const TextStyle(fontWeight: FontWeight.w700)),
            trailing: IconButton(
              icon: Icon(_expanded
                  ? Icons.keyboard_arrow_up
                  : Icons.keyboard_arrow_down),
              onPressed: () => setState(() => _expanded = !_expanded),
            ),
          ),
          if (_expanded)
            ...directions.map((dir) {
              final headsign = dir['headsign']?.toString() ?? '';
              final stops =
                  (dir['stops'] as List? ?? const []).cast<Map<String, dynamic>>();
              return Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(
                        'Direzione $headsign',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: lineColor,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    // Mappa stazioni verticale
                    ...stops.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final stop = entry.value;
                      final stopId =
                          (stop['stop_id'] ?? stop['stopId'] ?? '').toString();
                      final stopName =
                          (stop['stop_name'] ?? stop['stopName'] ?? '')
                              .toString();
                      final isFirst = idx == 0;
                      final isLast = idx == stops.length - 1;
                      return IntrinsicHeight(
                        child: Row(
                          children: [
                            SizedBox(
                              width: 28,
                              child: Column(
                                children: [
                                  Container(
                                    width: 2,
                                    height: isFirst ? 12 : 16,
                                    color: isFirst
                                        ? Colors.transparent
                                        : lineColor,
                                  ),
                                  Container(
                                    width: 12,
                                    height: 12,
                                    decoration: BoxDecoration(
                                      color: lineColor,
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                          color: Colors.white, width: 2),
                                    ),
                                  ),
                                  Container(
                                    width: 2,
                                    height: isLast ? 12 : 16,
                                    color:
                                        isLast ? Colors.transparent : lineColor,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: GestureDetector(
                                onTap: stopId.isNotEmpty
                                    ? () => context.push(
                                        '/stops/${Uri.encodeComponent(stopId)}')
                                    : null,
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                      vertical: 4),
                                  child: Text(
                                    stopName.replaceFirst('METRO ', ''),
                                    style: TextStyle(
                                      fontWeight: isFirst || isLast
                                          ? FontWeight.w700
                                          : FontWeight.w400,
                                      fontSize: 14,
                                      color: isFirst || isLast
                                          ? lineColor
                                          : null,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}

// ─── Tab Percorso ─────────────────────────────────────────────────────────────

class _MetroPlannerTab extends ConsumerStatefulWidget {
  const _MetroPlannerTab();

  @override
  ConsumerState<_MetroPlannerTab> createState() => _MetroPlannerTabState();
}

class _MetroPlannerTabState extends ConsumerState<_MetroPlannerTab> {
  Stop? _from;
  Stop? _to;
  bool _loading = false;
  String? _error;
  List<Map<String, dynamic>> _journeys = const [];

  Future<void> _search() async {
    if (_from == null || _to == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ref
          .read(journeyApiProvider)
          .searchMetro(_from!.stopId, _to!.stopId);
      final journeys = (data['journeys'] as List? ?? const [])
          .map((e) => (e as Map).cast<String, dynamic>())
          .toList();
      setState(() => _journeys = journeys);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _StopAutocompleteField(
          label: 'Partenza metro',
          selected: _from,
          excludeStop: _to,
          onSelected: (s) => setState(() => _from = s),
        ),
        const SizedBox(height: 8),
        _StopAutocompleteField(
          label: 'Arrivo metro',
          selected: _to,
          excludeStop: _from,
          onSelected: (s) => setState(() => _to = s),
        ),
        const SizedBox(height: 10),
        FilledButton.icon(
          onPressed: _loading ? null : _search,
          icon: const Icon(Icons.search),
          label: const Text('Cerca corse metro'),
        ),
        if (_error != null) ...[
          const SizedBox(height: 10),
          Text('Errore: $_error',
              style: const TextStyle(color: AppColors.delayHeavy)),
        ],
        if (_loading) ...[
          const SizedBox(height: 16),
          const Center(child: CircularProgressIndicator()),
        ],
        if (_journeys.isNotEmpty) ...[
          const SizedBox(height: 12),
          ..._journeys.map((j) => _MetroJourneyCard(journey: j)),
        ],
      ],
    );
  }
}

class _StopAutocompleteField extends ConsumerWidget {
  final String label;
  final Stop? selected;
  final Stop? excludeStop;
  final ValueChanged<Stop?> onSelected;
  const _StopAutocompleteField({
    required this.label,
    required this.selected,
    required this.onSelected,
    this.excludeStop,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final infoAsync = ref.watch(_metroInfoProvider);
    return infoAsync.when(
      loading: () => TextField(
        decoration: InputDecoration(labelText: label),
        enabled: false,
      ),
      error: (_, __) => TextField(
        decoration: InputDecoration(labelText: label, errorText: 'Errore'),
        enabled: false,
      ),
      data: (info) {
        // Raccoglie tutte le fermate uniche da tutte le direzioni di tutti i percorsi
        final seenIds = <String>{};
        final allStops = <Stop>[];
        for (final route in (info['routes'] as List? ?? [])) {
          for (final dir in ((route as Map)['directions'] as List? ?? [])) {
            for (final raw in ((dir as Map)['stops'] as List? ?? [])) {
            final s = (raw as Map).cast<String, dynamic>();
            final id = (s['stop_id'] ?? s['stopId'] ?? '').toString();
            if (id.isEmpty || seenIds.contains(id)) continue;
            seenIds.add(id);
            allStops.add(Stop(
              stopId: id,
              stopName:
                  (s['stop_name'] ?? s['stopName'] ?? id).toString(),
              stopCode: (s['stop_code'] ?? s['stopCode'] ?? '').toString(),
              stopLat: (s['stop_lat'] ?? s['lat'] ?? 0).toDouble(),
              stopLon: (s['stop_lon'] ?? s['lon'] ?? 0).toDouble(),
              routes: const [],
            ));
          }
          }
        }
        final available = excludeStop == null
            ? allStops
            : allStops.where((s) => s.stopId != excludeStop!.stopId).toList();

        return DropdownButtonFormField<Stop>(
          initialValue: available.where((s) => s.stopId == selected?.stopId).isEmpty
              ? null
              : available
                  .firstWhere((s) => s.stopId == selected!.stopId),
          decoration: InputDecoration(labelText: label),
          hint: Text('Seleziona stazione…'),
          isExpanded: true,
          items: available
              .map((s) => DropdownMenuItem<Stop>(
                    value: s,
                    child: Text(
                      s.stopName.replaceFirst('METRO ', ''),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ))
              .toList(),
          onChanged: onSelected,
        );
      },
    );
  }
}

class _MetroJourneyCard extends StatelessWidget {
  final Map<String, dynamic> journey;
  const _MetroJourneyCard({required this.journey});

  @override
  Widget build(BuildContext context) {
    final routeShort = (journey['routeShortName'] ?? '?').toString();
    final routeColor = journey['routeColor']?.toString();
    final routeText = journey['routeTextColor']?.toString();
    final departure = (journey['departureTime'] ?? '--:--').toString();
    final arrival = (journey['arrivalTime'] ?? '--:--').toString();
    final headsign = (journey['headsign'] ?? '').toString();
    final wait = journey['waitMinutes'];
    final total = journey['totalMinutes'];
    final tripId = journey['tripId']?.toString();
    final stops = (journey['stops'] as List? ?? const []);
    String? fromStop;
    String? toStop;
    for (final raw in stops) {
      final s = (raw as Map).cast<String, dynamic>();
      if (s['isFrom'] == true) fromStop = s['stopId']?.toString();
      if (s['isTo'] == true) toStop = s['stopId']?.toString();
    }

    final vehicleData = (journey['vehicle'] as Map?)?.cast<String, dynamic>();
    final vehicleAvailable = vehicleData?['available'] == true;
    final vehicleStatus = vehicleData?['currentStatus']?.toString();
    final vehicleArrivalMinutes = journey['vehicleArrivalMinutes'] as int?;

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                RouteChip(
                  shortName: routeShort,
                  color: routeColor,
                  textColor: routeText,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(headsign,
                      maxLines: 1, overflow: TextOverflow.ellipsis),
                ),
                Text('$departure → $arrival',
                    style: const TextStyle(fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 6),
            Text('Attesa: ${wait ?? '--'} min · Totale: ${total ?? '--'} min'),
            // Indicatore veicolo in posizione
            if (vehicleAvailable) ...[
              const SizedBox(height: 8),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.onTimeBg,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
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
                    const SizedBox(width: 6),
                    Text(
                      vehicleStatus != null && vehicleStatus.isNotEmpty
                          ? 'Treno in posizione — $vehicleStatus'
                          : 'Treno in posizione',
                      style: const TextStyle(
                        color: AppColors.onTime,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (vehicleArrivalMinutes != null) ...[
                      const SizedBox(width: 8),
                      Text(
                        '~$vehicleArrivalMinutes min all\'arrivo',
                        style: const TextStyle(
                            color: AppColors.onTime, fontSize: 12),
                      ),
                    ],
                  ],
                ),
              ),
            ],
            const SizedBox(height: 8),
            if (stops.isNotEmpty)
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: stops.map((raw) {
                  final s = (raw as Map).cast<String, dynamic>();
                  final name = (s['stopName'] ?? '').toString();
                  final from = s['isFrom'] == true;
                  final to = s['isTo'] == true;
                  final isEndpoint = from || to;
                  return Chip(
                    label: Text(
                      name.replaceFirst('METRO ', ''),
                      style: TextStyle(
                        color:
                            isEndpoint ? Colors.white : AppColors.text1,
                        fontSize: 11,
                        fontWeight: isEndpoint
                            ? FontWeight.w700
                            : FontWeight.w400,
                      ),
                    ),
                    backgroundColor: isEndpoint
                        ? const Color(0xFFDC2626)
                        : AppColors.surface3,
                    side: isEndpoint
                        ? BorderSide.none
                        : const BorderSide(color: AppColors.divider),
                    visualDensity: VisualDensity.compact,
                  );
                }).toList(),
              ),
            if (tripId != null && tripId.isNotEmpty) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => context.push(
                        '/map?tripId=${Uri.encodeQueryComponent(tripId)}&typeFilter=1',
                      ),
                      icon: const Icon(Icons.location_searching),
                      label: const Text('Segui'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () {
                        final params = <String, String>{};
                        if (fromStop != null) params['fromStop'] = fromStop;
                        if (toStop != null) params['toStop'] = toStop;
                        final qp = params.isEmpty
                            ? ''
                            : '?${Uri(queryParameters: params).query}';
                        context
                            .push('/trips/${Uri.encodeComponent(tripId)}$qp');
                      },
                      icon: const Icon(Icons.alt_route),
                      label: const Text('Dettaglio'),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

