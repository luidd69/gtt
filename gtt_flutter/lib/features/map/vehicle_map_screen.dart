import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../../core/api/arrivals_api.dart';
import '../../core/api/stops_api.dart';
import '../../core/api/trips_api.dart';
import '../../core/models/stop.dart';
import '../../core/models/vehicle.dart';
import '../../core/providers/location_provider.dart';
import '../../core/theme/colors.dart';
import '../../widgets/bottom_nav.dart';
import '../../widgets/route_chip.dart';
import 'map_provider.dart';

const _torinoCenter = LatLng(45.0703, 7.6869);

// Provider per il percorso del trip (polyline + dot fermate)
final _tripRouteProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>(
  (ref, tripId) => ref.watch(tripsApiProvider).getTripLive(tripId),
);

// Provider mini-arrivi per fermata in mappa
final _mapStopArrivalsProvider = FutureProvider.autoDispose
    .family<List<dynamic>, String>((ref, stopId) async {
  final arrivals = await ref
      .watch(arrivalsApiProvider)
      .getArrivals(stopId, limit: 5);
  return arrivals;
});

class VehicleMapScreen extends ConsumerStatefulWidget {
  final String? initialTripId;
  final int? initialTypeFilter;
  const VehicleMapScreen({super.key, this.initialTripId, this.initialTypeFilter});

  @override
  ConsumerState<VehicleMapScreen> createState() => _VehicleMapScreenState();
}

class _VehicleMapScreenState extends ConsumerState<VehicleMapScreen> {
  final _mapCtrl = MapController();
  final _searchCtrl = TextEditingController();
  String? _pendingTripId;
  bool _tripFallbackAttempted = false;
  int _pendingFollowRetryCount = 0;
  static const _maxFollowRetries = 10; // 10 × 5 s poll = 50 s
  double _currentZoom = 13.5;
  List<Stop> _nearbyStops = [];
  Timer? _stopFetchTimer;
  String? _trackedTripId;
  // Nasconde tutti i veicoli mentre si cerca quello da seguire
  bool _pendingFollow = false;

  @override
  void initState() {
    super.initState();
    _pendingTripId = widget.initialTripId;
    _trackedTripId = widget.initialTripId;
    _pendingFollow = widget.initialTripId != null;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(locationProvider.notifier).fetch();
      if (widget.initialTypeFilter != null) {
        ref
            .read(mapControllerProvider.notifier)
            .setTypeFilter(widget.initialTypeFilter);
      }
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _stopFetchTimer?.cancel();
    super.dispose();
  }

  Color _parseHexColor(String? hex, Color fallback) {
    if (hex == null || hex.isEmpty) return fallback;
    try {
      final clean = hex.replaceFirst('#', '');
      return Color(int.parse('FF${clean.padLeft(6, '0')}', radix: 16));
    } catch (_) {
      return fallback;
    }
  }

  /// Confronta tripId in più formati: MQTT usa numerico ("27956054"),
  /// OTP usa suffisso U ("27956054U"). Controlla anche gtfsTripId.
  bool _matchesTripId(Vehicle v, String tripId) {
    if (v.tripId == tripId) return true;
    if (v.gtfsTripId == tripId) return true;
    final stripped = tripId.endsWith('U')
        ? tripId.substring(0, tripId.length - 1)
        : tripId;
    final withU = '${stripped}U';
    return v.tripId == stripped ||
        v.tripId == withU ||
        v.gtfsTripId == stripped ||
        v.gtfsTripId == withU;
  }

  void _onMapPositionChanged(MapPosition position, bool hasGesture) {    if (!hasGesture) return;
    final zoom = position.zoom ?? _currentZoom;
    final center = position.center;
    if (center == null) return;
    if ((zoom - _currentZoom).abs() > 0.1) {
      setState(() => _currentZoom = zoom);
    }
    if (zoom >= 15) {
      _stopFetchTimer?.cancel();
      _stopFetchTimer = Timer(const Duration(milliseconds: 600), () async {
        try {
          final stops = await ref
              .read(stopsApiProvider)
              .nearby(center.latitude, center.longitude, radius: 0.3);
          if (mounted) setState(() => _nearbyStops = stops);
        } catch (_) {}
      });
    } else if (_nearbyStops.isNotEmpty) {
      setState(() => _nearbyStops = []);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mapState = ref.watch(mapControllerProvider);
    final mapCtrl = ref.read(mapControllerProvider.notifier);
    final locState = ref.watch(locationProvider).valueOrNull;

    ref.listen<MapViewState>(mapControllerProvider, (prev, next) {
      if (_pendingTripId != null &&
          next.vehicles.isNotEmpty) {
        var found = false;
        for (final v in next.vehicles) {
          if (_matchesTripId(v, _pendingTripId!)) {
            _pendingTripId = null; // Azzera PRIMA di cambiare stato per evitare re-entrata del listener
            ref.read(mapControllerProvider.notifier).selectVehicle(v);
            ref.read(mapControllerProvider.notifier).enableFollow();
            setState(() => _pendingFollow = false);
            found = true;
            break;
          }
        }
        if (!found && !_tripFallbackAttempted) {
          _tripFallbackAttempted = true;
          _trackTripFallback(_pendingTripId!);
        }
      }
      // Aggiorna il trip tracciato quando si seleziona un veicolo
      final nextTripId = next.selected?.gtfsTripId ?? next.selected?.tripId;
      final prevTripId = prev?.selected?.gtfsTripId ?? prev?.selected?.tripId;
      if (nextTripId != prevTripId) {
        setState(() => _trackedTripId = nextTripId);
      }
      if (next.followSelected && next.selected != null) {
        _mapCtrl.move(LatLng(next.selected!.lat, next.selected!.lon), 15);
      }
      if (next.highlightedStop != null &&
          next.highlightedStop != prev?.highlightedStop) {
        _mapCtrl.move(
          LatLng(next.highlightedStop!.stopLat, next.highlightedStop!.stopLon),
          16,
        );
      }
    });

    final routes = mapState.vehicles
        .map((v) => (v.routeShortName ?? '').trim())
        .where((s) => s.isNotEmpty)
        .toSet()
        .toList()
      ..sort();

    // Dati percorso corsa selezionata
    final tripRoute = _trackedTripId != null
        ? ref.watch(_tripRouteProvider(_trackedTripId!)).valueOrNull
        : null;
    final tripStops = tripRoute != null
        ? ((tripRoute['stops'] as List?) ?? const [])
            .cast<Map<String, dynamic>>()
        : <Map<String, dynamic>>[];
    final tripColor = _parseHexColor(
      mapState.selected?.routeColor,
      AppColors.brand,
    );
    final passedPoints = tripStops
        .where((s) => s['passed'] == true)
        .map((s) => LatLng(
              (s['lat'] as num).toDouble(),
              (s['lon'] as num).toDouble(),
            ))
        .toList();
    final futurePoints = tripStops
        .where((s) => s['passed'] != true)
        .map((s) => LatLng(
              (s['lat'] as num).toDouble(),
              (s['lon'] as num).toDouble(),
            ))
        .toList();
    // La polyline futura parte dall'ultimo punto passato
    final futureLine = passedPoints.isNotEmpty
        ? [passedPoints.last, ...futurePoints]
        : futurePoints;

    return Scaffold(
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapCtrl,
            options: MapOptions(
              initialCenter: locState?.hasLocation == true
                  ? LatLng(locState!.lat!, locState.lon!)
                  : _torinoCenter,
              initialZoom: 13.5,
              onTap: (_, __) {
                // Non deselezionare il veicolo se si sta seguendo
                if (!mapState.followSelected) {
                  mapCtrl.selectVehicle(null);
                }
              },
              onPositionChanged: _onMapPositionChanged,
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'it.gtt.gtt_flutter',
              ),
              // Polyline percorso corsa (tratto passato grigio + futuro colorato)
              if (passedPoints.length >= 2)
                PolylineLayer(
                  polylines: [
                    Polyline(
                      points: passedPoints,
                      color: const Color(0xFFAEAEB2),
                      strokeWidth: 5,
                    ),
                  ],
                ),
              if (futureLine.length >= 2)
                PolylineLayer(
                  polylines: [
                    Polyline(
                      points: futureLine,
                      color: tripColor,
                      strokeWidth: 6,
                    ),
                  ],
                ),
              // Dot fermate del percorso
              if (tripStops.isNotEmpty)
                MarkerLayer(
                  markers: tripStops.asMap().entries.map((entry) {
                    final i = entry.key;
                    final s = entry.value;
                    final lat = (s['lat'] as num?)?.toDouble();
                    final lon = (s['lon'] as num?)?.toDouble();
                    if (lat == null || lon == null) {
                      return Marker(
                          point: const LatLng(0, 0),
                          child: const SizedBox.shrink());
                    }
                    final passed = s['passed'] == true;
                    final isEndpoint =
                        i == 0 || i == tripStops.length - 1;
                    final dotSize = isEndpoint ? 16.0 : 10.0;
                    final dotColor =
                        passed ? const Color(0xFFAEAEB2) : tripColor;
                    return Marker(
                      point: LatLng(lat, lon),
                      width: dotSize + 4,
                      height: dotSize + 4,
                      child: Container(
                        width: dotSize,
                        height: dotSize,
                        decoration: BoxDecoration(
                          color: dotColor,
                          shape: BoxShape.circle,
                          border:
                              Border.all(color: Colors.white, width: 1.5),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              MarkerLayer(
                markers: () {
                  // Follow attivo + veicolo selezionato: mostra solo quello
                  if (mapState.followSelected && mapState.selected != null) {
                    return [
                      _vehicleMarker(
                          mapState.selected!, mapState.selected, mapCtrl)
                    ];
                  }
                  // Ricerca veicolo in corso: nasconde gli altri
                  if (_pendingFollow) {
                    return mapState.selected != null
                        ? [
                            _vehicleMarker(
                                mapState.selected!, mapState.selected, mapCtrl)
                          ]
                        : const <Marker>[];
                  }
                  // Default: tutti i veicoli filtrati
                  return mapState.filteredVehicles
                      .map((v) =>
                          _vehicleMarker(v, mapState.selected, mapCtrl))
                      .toList();
                }(),
              ),
              if (locState?.hasLocation == true)
                MarkerLayer(markers: [
                  Marker(
                    point: LatLng(locState!.lat!, locState.lon!),
                    width: 20,
                    height: 20,
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.brand,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 3),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.brand.withAlpha(80),
                            blurRadius: 8,
                          ),
                        ],
                      ),
                    ),
                  ),
                ]),
              // Fermate visibili a zoom ≥ 15
              if (_currentZoom >= 15 && _nearbyStops.isNotEmpty)
                MarkerLayer(
                  markers: _nearbyStops
                      .map((s) => Marker(
                            point: LatLng(s.stopLat, s.stopLon),
                            width: 28,
                            height: 28,
                            child: GestureDetector(
                              onTap: () {
                                mapCtrl.selectStop(s);
                              },
                              child: Container(
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                      color: AppColors.brand, width: 2),
                                  boxShadow: const [
                                    BoxShadow(
                                        color: Colors.black26, blurRadius: 4)
                                  ],
                                ),
                                alignment: Alignment.center,
                                child: const Icon(Icons.directions_bus,
                                    size: 14, color: AppColors.brand),
                              ),
                            ),
                          ))
                      .toList(),
                ),
              // Fermata evidenziata — deve stare SOPRA le fermate vicine
              if (mapState.highlightedStop != null)
                MarkerLayer(markers: [
                  Marker(
                    point: LatLng(
                      mapState.highlightedStop!.stopLat,
                      mapState.highlightedStop!.stopLon,
                    ),
                    width: 54,
                    height: 54,
                    child: const _BlinkingStopMarker(),
                  ),
                ]),
            ],
          ),
          Positioned(
            top: MediaQuery.of(context).padding.top + 6,
            left: 12,
            right: 12,
            child: Column(
              children: [
                Container(
                  decoration: BoxDecoration(
                    color: Theme.of(context)
                        .scaffoldBackgroundColor
                        .withAlpha(240),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.arrow_back),
                        onPressed: () => context.canPop()
                            ? context.pop()
                            : context.go('/home'),
                      ),
                      Expanded(
                        child: TextField(
                          controller: _searchCtrl,
                          decoration: const InputDecoration(
                            hintText: 'Cerca fermata in mappa',
                            border: InputBorder.none,
                            isDense: true,
                          ),
                          onChanged: mapCtrl.searchStops,
                        ),
                      ),
                      if (_searchCtrl.text.isNotEmpty)
                        IconButton(
                          icon: const Icon(Icons.clear, size: 18),
                          onPressed: () {
                            _searchCtrl.clear();
                            mapCtrl.searchStops('');
                          },
                        ),
                    ],
                  ),
                ),
                if (mapState.searchResults.isNotEmpty)
                  Container(
                    margin: const EdgeInsets.only(top: 4),
                    decoration: BoxDecoration(
                      color: Theme.of(context)
                          .scaffoldBackgroundColor
                          .withAlpha(245),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: mapState.searchResults
                          .map((s) => InkWell(
                                onTap: () {
                                  _searchCtrl.text = s.stopName;
                                  mapCtrl.selectStop(s);
                                },
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 10),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.directions_bus_outlined,
                                          size: 16, color: AppColors.brand),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Text(
                                              s.stopName,
                                              style: const TextStyle(
                                                  fontSize: 14,
                                                  color: AppColors.text1),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            Text(
                                              'Fermata ${s.stopCode}',
                                              style: const TextStyle(
                                                  fontSize: 12,
                                                  color: AppColors.text3),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ))
                          .toList(),
                    ),
                  ),
                if (routes.isNotEmpty)
                  // Filtro per tipo mezzo (tab)
                  Container(
                    margin: const EdgeInsets.only(top: 4),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 6, vertical: 4),
                    decoration: BoxDecoration(
                      color: Theme.of(context)
                          .scaffoldBackgroundColor
                          .withAlpha(230),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          _TypeFilterChip(
                            label: '🚌 Tutti',
                            selected: mapState.typeFilter == null &&
                                mapState.routeFilter.isEmpty,
                            onTap: () {
                              mapCtrl.setTypeFilter(null);
                              mapCtrl.setRouteFilter('');
                            },
                          ),
                          const SizedBox(width: 4),
                          _TypeFilterChip(
                            label: '🚌 Bus',
                            selected: mapState.typeFilter == 3,
                            onTap: () => mapCtrl.setTypeFilter(
                                mapState.typeFilter == 3 ? null : 3),
                          ),
                          const SizedBox(width: 4),
                          _TypeFilterChip(
                            label: '🚃 Tram',
                            selected: mapState.typeFilter == 0,
                            onTap: () => mapCtrl.setTypeFilter(
                                mapState.typeFilter == 0 ? null : 0),
                          ),
                          const SizedBox(width: 4),
                          _TypeFilterChip(
                            label: '🚇 Metro',
                            selected: mapState.typeFilter == 1,
                            onTap: () => mapCtrl.setTypeFilter(
                                mapState.typeFilter == 1 ? null : 1),
                          ),
                          if (mapState.typeFilter != null) ...[
                            const SizedBox(width: 8),
                            const VerticalDivider(width: 1),
                            const SizedBox(width: 8),
                            ...routes
                                .where((r) {
                                  final filtered = mapState.vehicles.where(
                                    (v) => (v.routeShortName ?? '').trim() == r
                                        && (mapState.typeFilter == null ||
                                            v.routeType == mapState.typeFilter),
                                  );
                                  return filtered.isNotEmpty;
                                })
                                .take(12)
                                .map((r) => Padding(
                                      padding:
                                          const EdgeInsets.only(right: 4),
                                      child: _TypeFilterChip(
                                        label: r,
                                        selected: mapState.routeFilter ==
                                            r.toLowerCase(),
                                        onTap: () => mapCtrl.setRouteFilter(
                                            mapState.routeFilter ==
                                                    r.toLowerCase()
                                                ? ''
                                                : r),
                                      ),
                                    )),
                          ],
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Positioned(
            bottom: 90,
            right: 16,
            child: FloatingActionButton.small(
              heroTag: 'center_me',
              onPressed: () {
                if (locState?.hasLocation == true) {
                  _mapCtrl.move(LatLng(locState!.lat!, locState.lon!), 15);
                } else {
                  ref.read(locationProvider.notifier).fetch();
                }
              },
              child: const Icon(Icons.my_location),
            ),
          ),
          if (mapState.selected != null)
            Positioned(
              bottom: 80,
              left: 16,
              right: 16,
              child: _VehiclePopup(
                vehicle: mapState.selected!,
                following: mapState.followSelected,
                onToggleFollow: mapCtrl.toggleFollow,
                onOpenTrip: (mapState.selected!.gtfsTripId ?? mapState.selected!.tripId) == null
                    ? null
                    : () => context.push(
                          '/trips/${Uri.encodeComponent(mapState.selected!.gtfsTripId ?? mapState.selected!.tripId!)}',
                        ),
                onClose: () => mapCtrl.selectVehicle(null),
              ),
            ),
          if (mapState.highlightedStop != null)
            Positioned(
              bottom: mapState.selected != null ? 210 : 80,
              left: 0,
              right: 0,
              child: _StopBottomPanel(
                stop: mapState.highlightedStop!,
                onDismiss: mapCtrl.clearHighlightedStop,
                onOpenStop: () => context.push(
                  '/stops/${Uri.encodeComponent(mapState.highlightedStop!.stopId)}',
                ),
              ),
            ),
          if (mapState.error != null)
            Positioned(
              top: MediaQuery.of(context).padding.top + 64,
              left: 16,
              right: 16,
              child: Material(
                color: const Color(0xFFFEE2E2),
                borderRadius: BorderRadius.circular(10),
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: Color(0xFF991B1B)),
                      const SizedBox(width: 8),
                      const Expanded(
                        child: Text(
                          'Errore caricamento mappa live',
                          style: TextStyle(color: Color(0xFF991B1B)),
                        ),
                      ),
                      TextButton(
                        onPressed: mapCtrl.refresh,
                        child: const Text('Riprova'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar: const BottomNav(currentIndex: 3),
    );
  }

  Future<void> _trackTripFallback(String tripId) async {
    try {
      final live = await ref.read(tripsApiProvider).getTripLive(tripId);
      if (!mounted) return;

      final found = live['found'] == true;
      final pos = live['position'] as Map<String, dynamic>?;

      if (found && pos != null) {
        final lat = (pos['lat'] as num?)?.toDouble();
        final lon = (pos['lon'] as num?)?.toDouble();

        if (lat != null && lon != null) {
          _mapCtrl.move(LatLng(lat, lon), 15);

          // Cerca il veicolo più vicino alla posizione interpolata
          final vehicles = ref.read(mapControllerProvider).vehicles;
          Vehicle? nearest;
          double nearestDistSq = double.infinity;
          for (final v in vehicles) {
            final dLat = v.lat - lat;
            final dLon = v.lon - lon;
            final distSq = dLat * dLat + dLon * dLon;
            if (distSq < nearestDistSq) {
              nearestDistSq = distSq;
              nearest = v;
            }
          }

          const maxDistSq = 0.005 * 0.005; // ~500 m in gradi
          if (nearest != null && nearestDistSq <= maxDistSq) {
            ref.read(mapControllerProvider.notifier).selectVehicle(nearest);
            ref.read(mapControllerProvider.notifier).enableFollow();
            if (mounted) {
              setState(() {
                _trackedTripId = nearest!.gtfsTripId ?? nearest.tripId ?? tripId;
                _pendingFollow = false;
              });
            }
            _pendingTripId = null; // trovato: smetti di cercare
            return;
          }
        }
      }

      // Veicolo non trovato: riprova al prossimo poll se non esaurito
      _pendingFollowRetryCount++;
      if (_pendingFollowRetryCount >= _maxFollowRetries) {
        // Troppi tentativi: mostra tutti i veicoli
        if (mounted) setState(() => _pendingFollow = false);
        _pendingTripId = null;
      } else {
        // Permetti nuovo tentativo al prossimo aggiornamento
        _tripFallbackAttempted = false;
      }
    } catch (_) {
      // Errore di rete: riprova
      _pendingFollowRetryCount++;
      if (_pendingFollowRetryCount >= _maxFollowRetries) {
        if (mounted) setState(() => _pendingFollow = false);
        _pendingTripId = null;
      } else {
        _tripFallbackAttempted = false;
      }
    }
  }

  Marker _vehicleMarker(
    Vehicle v,
    Vehicle? selected,
    MapLiveController mapCtrl,
  ) {
    return Marker(
      point: LatLng(v.lat, v.lon),
      width: 36,
      height: 36,
      child: GestureDetector(
        onTap: () => mapCtrl.selectVehicle(v),
        child: _VehicleIcon(
            vehicle: v, selected: selected?.vehicleId == v.vehicleId),
      ),
    );
  }
}

class _VehicleIcon extends StatelessWidget {
  final Vehicle vehicle;
  final bool selected;
  const _VehicleIcon({required this.vehicle, required this.selected});

  Color _parseColor(String? hex) {
    if (hex == null || hex.isEmpty) return AppColors.brand;
    try {
      return Color(int.parse('FF${hex.replaceFirst('#', '')}', radix: 16));
    } catch (_) {
      return AppColors.brand;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _parseColor(vehicle.routeColor);
    return Transform.rotate(
      angle: vehicle.bearing != null ? vehicle.bearing! * 3.14159 / 180 : 0,
      child: Container(
        width: selected ? 36 : 28,
        height: selected ? 36 : 28,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: selected ? 3 : 2),
          boxShadow: [BoxShadow(color: color.withAlpha(100), blurRadius: 6)],
        ),
        alignment: Alignment.center,
        child: Text(
          vehicle.routeShortName
                  ?.substring(0, vehicle.routeShortName!.length.clamp(0, 3)) ??
              '?',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 9,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}

class _VehiclePopup extends StatelessWidget {
  final Vehicle vehicle;
  final bool following;
  final VoidCallback onClose;
  final VoidCallback onToggleFollow;
  final VoidCallback? onOpenTrip;

  const _VehiclePopup({
    required this.vehicle,
    required this.following,
    required this.onClose,
    required this.onToggleFollow,
    required this.onOpenTrip,
  });

  String _routeTypeLabel(int? type) {
    switch (type) {
      case 1:
        return 'Metro';
      case 0:
        return 'Tram';
      default:
        return 'Bus';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (vehicle.routeShortName != null)
                  RouteChip(
                      shortName: vehicle.routeShortName!,
                      color: vehicle.routeColor),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (vehicle.headsign != null)
                        Text(
                          vehicle.headsign!,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      Text(
                        _routeTypeLabel(vehicle.routeType),
                        style: const TextStyle(
                            color: AppColors.text3, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 18, color: AppColors.text3),
                  onPressed: onClose,
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                ),
              ],
            ),
            const SizedBox(height: 8),
            // Dettagli tecnici
            Wrap(
              spacing: 12,
              runSpacing: 4,
              children: [
                if (vehicle.speed != null)
                  _InfoChip(
                      icon: Icons.speed,
                      label: '${vehicle.speed!.toStringAsFixed(0)} km/h'),
                if (vehicle.bearing != null)
                  _InfoChip(
                      icon: Icons.explore,
                      label: '${vehicle.bearing!.round()}°'),
                if (vehicle.currentStatus != null)
                  _InfoChip(
                      icon: Icons.info_outline,
                      label: _statusLabel(vehicle.currentStatus!)),
                if (vehicle.vehicleId.isNotEmpty)
                  _InfoChip(
                      icon: Icons.directions_bus,
                      label: vehicle.vehicleId),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onToggleFollow,
                    icon: Icon(following ? Icons.gps_fixed : Icons.gps_not_fixed),
                    label: Text(following ? 'Interrompi' : 'Segui'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: onOpenTrip,
                    icon: const Icon(Icons.alt_route),
                    label: const Text('Corsa'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _statusLabel(String s) {
    switch (s.toUpperCase()) {
      case 'IN_TRANSIT_TO':
        return 'In transito';
      case 'STOPPED_AT':
        return 'Fermato';
      case 'INCOMING_AT':
        return 'In arrivo';
      default:
        return s;
    }
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  const _InfoChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: AppColors.text3),
          const SizedBox(width: 3),
          Text(label, style: const TextStyle(fontSize: 12, color: AppColors.text2)),
        ],
      );
}

class _TypeFilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _TypeFilterChip(
      {required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: selected ? AppColors.brand : AppColors.brand.withAlpha(20),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: selected ? Colors.white : AppColors.brand,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
        ),
      );
}

// Pannello fermata con mini-arrivi
class _StopBottomPanel extends ConsumerWidget {
  final Stop stop;
  final VoidCallback onDismiss;
  final VoidCallback onOpenStop;

  const _StopBottomPanel({
    required this.stop,
    required this.onDismiss,
    required this.onOpenStop,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final arrivalsAsync = ref.watch(_mapStopArrivalsProvider(stop.stopId));

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
        boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 12)],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                const Icon(Icons.directions_bus_outlined,
                    color: AppColors.brand, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        stop.stopName,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      Text(
                        'Fermata ${stop.stopCode}',
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.text3),
                      ),
                    ],
                  ),
                ),
                TextButton(
                  onPressed: onOpenStop,
                  child: const Text('Tutti gli arrivi →'),
                ),
                IconButton(
                  icon:
                      const Icon(Icons.close, size: 18, color: AppColors.text3),
                  onPressed: onDismiss,
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          arrivalsAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.all(12),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            ),
            error: (_, __) => const Padding(
              padding: EdgeInsets.all(12),
              child: Text('Errore caricamento arrivi',
                  style: TextStyle(color: AppColors.text3)),
            ),
            data: (arrivals) => arrivals.isEmpty
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: Text('Nessun arrivo previsto',
                        style: TextStyle(color: AppColors.text3)),
                  )
                : Column(
                    children: [
                      for (final a in arrivals)
                        Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 7),
                          child: Row(
                            children: [
                              RouteChip(
                                shortName: a.routeShortName,
                                color: a.routeColor,
                                textColor: a.routeTextColor,
                                small: true,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  a.headsign,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      fontSize: 13, color: AppColors.text1),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: a.waitMinutes != null &&
                                          a.waitMinutes! <= 1
                                      ? AppColors.onTimeBg
                                      : AppColors.surface3,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  a.waitMinutes != null
                                      ? (a.waitMinutes! <= 0
                                          ? 'In arrivo'
                                          : '${a.waitMinutes} min')
                                      : a.displayTime,
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 12,
                                    color: a.waitMinutes != null &&
                                            a.waitMinutes! <= 1
                                        ? AppColors.onTime
                                        : AppColors.text2,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

/// Marker animato (blink rosso) per la fermata selezionata sulla mappa.
class _BlinkingStopMarker extends StatefulWidget {
  const _BlinkingStopMarker();

  @override
  State<_BlinkingStopMarker> createState() => _BlinkingStopMarkerState();
}

class _BlinkingStopMarkerState extends State<_BlinkingStopMarker>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..repeat(reverse: true);
    _anim = Tween<double>(begin: 1.0, end: 0.15).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (_, __) => Stack(
        alignment: Alignment.center,
        children: [
          // Alone pulsante
          Opacity(
            opacity: _anim.value * 0.35,
            child: Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: const Color(0xFFE8431B),
                shape: BoxShape.circle,
              ),
            ),
          ),
          // Dot centrale
          Opacity(
            opacity: _anim.value,
            child: Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                color: const Color(0xFFE8431B),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2.5),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x66E8431B),
                    blurRadius: 8,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
