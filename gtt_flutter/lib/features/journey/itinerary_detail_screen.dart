import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../../core/models/itinerary.dart';
import '../../core/models/leg.dart';
import '../../core/theme/colors.dart';
import '../../widgets/route_chip.dart';

class ItineraryDetailScreen extends StatelessWidget {
  final Itinerary itinerary;
  const ItineraryDetailScreen({super.key, required this.itinerary});

  @override
  Widget build(BuildContext context) {
    final it = itinerary;

    return Scaffold(
      backgroundColor: AppColors.surface3,
      appBar: AppBar(
        backgroundColor: AppColors.brand,
        foregroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${it.departureTime} → ${it.arrivalTime}',
              style: const TextStyle(
                  fontWeight: FontWeight.w800, fontSize: 15, color: Colors.white),
            ),
            Text(
              '${it.durationMinutes} min · ${it.transfers == 0 ? 'diretto' : '${it.transfers} cambi'}',
              style: TextStyle(fontSize: 12, color: Colors.white.withAlpha(200)),
            ),
          ],
        ),
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: it.legs.length + 1,
        itemBuilder: (_, i) {
          if (i == 0) return _ItineraryMap(itinerary: it);
          final idx = i - 1;
          return _LegTile(leg: it.legs[idx], isLast: idx == it.legs.length - 1);
        },
      ),
    );
  }
}

// ─── Decoder Google Encoded Polyline (inline, nessun package aggiuntivo) ─────
List<LatLng> _decodePolyline(String encoded) {
  final result = <LatLng>[];
  int index = 0, lat = 0, lng = 0;
  final bytes = encoded.codeUnits;
  while (index < bytes.length) {
    int b, shift = 0, result2 = 0;
    do {
      b = bytes[index++] - 63;
      result2 |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    final dLat = ((result2 & 1) != 0 ? ~(result2 >> 1) : (result2 >> 1));
    lat += dLat;
    shift = 0;
    result2 = 0;
    do {
      b = bytes[index++] - 63;
      result2 |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    final dLng = ((result2 & 1) != 0 ? ~(result2 >> 1) : (result2 >> 1));
    lng += dLng;
    result.add(LatLng(lat / 1e5, lng / 1e5));
  }
  return result;
}

Color _legColor(Leg leg, Color fallback) {
  if (leg.isWalk) return AppColors.text3;
  if (leg.routeColor == null || leg.routeColor!.isEmpty) return fallback;
  try {
    final clean = leg.routeColor!.replaceFirst('#', '');
    return Color(int.parse('FF$clean', radix: 16));
  } catch (_) {
    return fallback;
  }
}

// ─── Mappa itinerario ────────────────────────────────────────────────────────

class _ItineraryMap extends StatefulWidget {
  final Itinerary itinerary;
  const _ItineraryMap({required this.itinerary});

  @override
  State<_ItineraryMap> createState() => _ItineraryMapState();
}

class _ItineraryMapState extends State<_ItineraryMap> {
  final MapController _mapController = MapController();
  bool _expanded = false;

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  ({List<Polyline> lines, List<Marker> markers, LatLng center, double zoom})
      _buildMapData() {
    final polylines = <Polyline>[];
    final stopMarkers = <Marker>[];
    final allPoints = <LatLng>[];

    // Palette di colori fallback per tratte senza colore
    const fallbackColors = [
      Color(0xFF1565C0), // blue 800
      Color(0xFF2E7D32), // green 800
      Color(0xFF6A1B9A), // purple 800
      Color(0xFFE65100), // orange 800
      Color(0xFF00695C), // teal 700
    ];
    int legIdx = 0;

    for (final leg in widget.itinerary.legs) {
      final fallback = fallbackColors[legIdx % fallbackColors.length];
      final color = _legColor(leg, fallback);

      // Punti della polilinea: usa encodedPolyline se disponibile
      List<LatLng> points;
      if (leg.encodedPolyline != null && leg.encodedPolyline!.isNotEmpty) {
        points = _decodePolyline(leg.encodedPolyline!);
      } else {
        // Fallback: costruisci dalla sequenza di fermate
        points = [];
        if (leg.fromStop != null) {
          points.add(LatLng(leg.fromStop!.stopLat, leg.fromStop!.stopLon));
        }
        for (final s in leg.intermediateStops) {
          if (s.lat != null && s.lon != null) {
            points.add(LatLng(s.lat!, s.lon!));
          }
        }
        if (leg.toStop != null) {
          points.add(LatLng(leg.toStop!.stopLat, leg.toStop!.stopLon));
        }
      }

      if (points.length >= 2) {
        allPoints.addAll(points);
        polylines.add(Polyline(
          points: points,
          color: color.withAlpha(220),
          strokeWidth: leg.isWalk ? 3 : 5,
          isDotted: leg.isWalk,
        ));

        // Marker fermata inizio tratta
        if (leg.isTransit && points.isNotEmpty) {
          stopMarkers.add(_stopMarker(points.first, color, large: false));
          // Fermate intermedie
          for (final s in leg.intermediateStops) {
            if (s.lat != null && s.lon != null) {
              stopMarkers.add(_stopMarker(
                LatLng(s.lat!, s.lon!),
                color,
                large: false,
              ));
            }
          }
          // Ultima fermata della tratta
          stopMarkers.add(_stopMarker(points.last, color, large: false));
        }
      }

      if (leg.isTransit) legIdx++;
    }

    if (allPoints.isEmpty) {
      return (
        lines: <Polyline>[],
        markers: <Marker>[],
        center: const LatLng(45.07, 7.67),
        zoom: 13.0,
      );
    }

    // Marker speciale partenza e arrivo
    final start = allPoints.first;
    final end = allPoints.last;
    final bigMarkers = [
      Marker(
        point: start,
        width: 28,
        height: 28,
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.onTime,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2),
            boxShadow: const [BoxShadow(blurRadius: 4, color: Colors.black26)],
          ),
          child: const Icon(Icons.circle, color: Colors.white, size: 10),
        ),
      ),
      Marker(
        point: end,
        width: 28,
        height: 28,
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.brand,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2),
            boxShadow: const [BoxShadow(blurRadius: 4, color: Colors.black26)],
          ),
          child: const Icon(Icons.flag, color: Colors.white, size: 14),
        ),
      ),
    ];

    // Calcola bounds e centro
    double minLat = allPoints.first.latitude, maxLat = allPoints.first.latitude;
    double minLng = allPoints.first.longitude, maxLng = allPoints.first.longitude;
    for (final p in allPoints) {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude < minLng) minLng = p.longitude;
      if (p.longitude > maxLng) maxLng = p.longitude;
    }
    final center =
        LatLng((minLat + maxLat) / 2, (minLng + maxLng) / 2);

    // Stima zoom dalla dimensione del bounding box
    final latSpan = maxLat - minLat;
    final lngSpan = maxLng - minLng;
    final maxSpan = latSpan > lngSpan ? latSpan : lngSpan;
    double zoom = 14.0;
    if (maxSpan > 0.5) zoom = 11.0;
    else if (maxSpan > 0.2) zoom = 12.0;
    else if (maxSpan > 0.1) zoom = 13.0;
    else if (maxSpan > 0.05) zoom = 14.0;
    else zoom = 15.0;

    return (
      lines: polylines,
      markers: [...stopMarkers, ...bigMarkers],
      center: center,
      zoom: zoom,
    );
  }

  Marker _stopMarker(LatLng point, Color color, {required bool large}) {
    final size = large ? 16.0 : 10.0;
    return Marker(
      point: point,
      width: size,
      height: size,
      child: Container(
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 1.5),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final mapData = _buildMapData();
    if (mapData.lines.isEmpty && mapData.markers.isEmpty) {
      return const SizedBox.shrink();
    }

    final height = _expanded ? 400.0 : 220.0;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.divider),
      ),
      clipBehavior: Clip.antiAlias,
      child: SizedBox(
        height: height,
        child: Stack(
          children: [
            FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: mapData.center,
                initialZoom: mapData.zoom,
                interactionOptions: const InteractionOptions(
                  flags: InteractiveFlag.pinchZoom | InteractiveFlag.drag,
                ),
              ),
              children: [
                TileLayer(
                  urlTemplate:
                      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'it.gtt.gtt_flutter',
                ),
                PolylineLayer(polylines: mapData.lines),
                MarkerLayer(markers: mapData.markers),
              ],
            ),
            // Pulsante espandi / riduci
            Positioned(
              top: 8,
              right: 8,
              child: Material(
                color: Colors.white.withAlpha(230),
                borderRadius: BorderRadius.circular(8),
                child: InkWell(
                  borderRadius: BorderRadius.circular(8),
                  onTap: () => setState(() => _expanded = !_expanded),
                  child: Padding(
                    padding: const EdgeInsets.all(6),
                    child: Icon(
                      _expanded ? Icons.fullscreen_exit : Icons.fullscreen,
                      size: 20,
                      color: AppColors.text1,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LegTile extends StatefulWidget {
  final Leg leg;
  final bool isLast;
  const _LegTile({required this.leg, required this.isLast});

  @override
  State<_LegTile> createState() => _LegTileState();
}

class _LegTileState extends State<_LegTile> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final leg = widget.leg;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Timeline bar
          SizedBox(
            width: 32,
            child: Column(
              children: [
                Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    color: leg.isTransit
                        ? _parseColor(leg.routeColor, AppColors.brand)
                        : AppColors.text3,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                  ),
                ),
                Expanded(
                  child: Container(
                    width: 2,
                    color: leg.isWalk
                        ? AppColors.text3.withAlpha(80)
                        : _parseColor(leg.routeColor, AppColors.brand),
                    margin: const EdgeInsets.symmetric(horizontal: 5),
                  ),
                ),
                if (!widget.isLast)
                  Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.text3),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          // Content
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: leg.isWalk
                  ? _WalkLegContent(leg: leg)
                  : _TransitLegContent(
                      leg: leg,
                      expanded: _expanded,
                      onToggle: () => setState(() => _expanded = !_expanded),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Color _parseColor(String? hex, Color fallback) {
    if (hex == null || hex.isEmpty) return fallback;
    try {
      final clean = hex.replaceFirst('#', '');
      return Color(int.parse('FF$clean', radix: 16));
    } catch (_) {
      return fallback;
    }
  }
}

class _WalkLegContent extends StatelessWidget {
  final Leg leg;
  const _WalkLegContent({required this.leg});

  @override
  Widget build(BuildContext context) {
    final m = leg.distanceM.round();
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: AppColors.divider,
          style: BorderStyle.solid,
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.directions_walk, color: AppColors.text3, size: 20),
          const SizedBox(width: 8),
          Text(
            '${(leg.durationSeconds ~/ 60)} min a piedi',
            style: const TextStyle(
                color: AppColors.text2, fontWeight: FontWeight.w500),
          ),
          const Spacer(),
          Text(
            m < 1000 ? '$m m' : '${(m / 1000).toStringAsFixed(1)} km',
            style: const TextStyle(color: AppColors.text3, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class _TransitLegContent extends StatelessWidget {
  final Leg leg;
  final bool expanded;
  final VoidCallback onToggle;

  const _TransitLegContent({
    required this.leg,
    required this.expanded,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    RouteChip(
                      shortName: leg.routeShortName ?? '?',
                      color: leg.routeColor,
                      textColor: leg.routeTextColor,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        leg.headsign ?? '',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (leg.tripId != null && leg.tripId!.isNotEmpty)
                      IconButton(
                        tooltip: 'Apri corsa',
                        icon: const Icon(Icons.alt_route, size: 18),
                        onPressed: () {
                          final params = <String, String>{};
                          if (leg.fromStop?.stopId.isNotEmpty == true) {
                            params['fromStop'] = leg.fromStop!.stopId;
                          }
                          if (leg.toStop?.stopId.isNotEmpty == true) {
                            params['toStop'] = leg.toStop!.stopId;
                          }
                          final qp = params.isEmpty
                              ? ''
                              : '?${Uri(queryParameters: params).query}';
                          context.push(
                            '/trips/${Uri.encodeComponent(leg.tripId!)}$qp',
                          );
                        },
                      ),
                    Text(
                      '${leg.startTime} → ${leg.endTime}',
                      style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.text2,
                          fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
                if (leg.fromStop != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    'Da: ${leg.fromStop!.stopName}',
                    style:
                        const TextStyle(color: AppColors.text2, fontSize: 13),
                  ),
                ],
                if (leg.toStop != null)
                  Text(
                    'A: ${leg.toStop!.stopName}',
                    style:
                        const TextStyle(color: AppColors.text2, fontSize: 13),
                  ),
              ],
            ),
          ),
          if (leg.intermediateStops.isNotEmpty)
            InkWell(
              onTap: onToggle,
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    Text(
                      '${leg.intermediateStops.length} fermate intermedie',
                      style: const TextStyle(
                          color: AppColors.brand,
                          fontSize: 12,
                          fontWeight: FontWeight.w600),
                    ),
                    Icon(
                      expanded
                          ? Icons.keyboard_arrow_up
                          : Icons.keyboard_arrow_down,
                      color: AppColors.brand,
                      size: 16,
                    ),
                  ],
                ),
              ),
            ),
          if (expanded)
            ...leg.intermediateStops.map(
              (s) => Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 6),
                child: Row(
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: AppColors.text3,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(s.stopName,
                        style: const TextStyle(
                            color: AppColors.text2, fontSize: 12)),
                    const Spacer(),
                    if (s.departureTime != null)
                      Text(s.departureTime!,
                          style: const TextStyle(
                              color: AppColors.text3, fontSize: 12)),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 4),
        ],
      ),
    );
  }
}
