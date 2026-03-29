import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/stops_api.dart';
import '../../core/services/notification_service.dart';
import '../../core/theme/colors.dart';
import '../../widgets/delay_badge.dart';
import '../../widgets/loading_shimmer.dart';
import '../../widgets/route_chip.dart';
import 'trip_detail_provider.dart';

class TripDetailScreen extends ConsumerStatefulWidget {
  final String tripId;
  final String? fromStop;
  final String? toStop;

  const TripDetailScreen({
    super.key,
    required this.tripId,
    this.fromStop,
    this.toStop,
  });

  @override
  ConsumerState<TripDetailScreen> createState() => _TripDetailScreenState();
}

class _OnBoardCheckpoint {
  final String stopId;
  final String name;
  final bool isDestination;

  const _OnBoardCheckpoint({
    required this.stopId,
    required this.name,
    required this.isDestination,
  });
}

class _TripDetailScreenState extends ConsumerState<TripDetailScreen> {
  Timer? _refreshTimer;
  StreamSubscription<Position>? _positionSub;
  DateTime? _lastNearbyCheckAt;
  final Set<String> _alertFiredStopIds = <String>{};

  bool _onBoard = false;
  bool _gpsActive = false;
  bool _gpsBlocked = false;
  String? _onBoardAlert;

  TripDetailRequest get _request => TripDetailRequest(
        tripId: widget.tripId,
        fromStop: widget.fromStop,
        toStop: widget.toStop,
      );

  List<_OnBoardCheckpoint> _checkpointsFromStops(
      List<Map<String, dynamic>> stops) {
    if (stops.isEmpty) return const [];

    final candidates = stops.where((stop) {
      final stopId = stop['stopId']?.toString();
      if (stopId == null || stopId.isEmpty) return false;
      final status = (stop['status'] ?? '').toString().toLowerCase();
      return status != 'passed';
    }).toList();

    if (candidates.isEmpty) return const [];

    final destination = candidates.last;
    final destinationId = destination['stopId']?.toString() ?? '';
    final destinationName =
        (destination['stopName'] ?? destination['stop_name'] ?? 'Destinazione')
            .toString();

    final first = candidates.first;
    final firstId = first['stopId']?.toString() ?? '';
    final firstName =
        (first['stopName'] ?? first['stop_name'] ?? 'Prossima fermata')
            .toString();

    final out = <_OnBoardCheckpoint>[];
    if (firstId.isNotEmpty) {
      out.add(_OnBoardCheckpoint(
        stopId: firstId,
        name: firstName,
        isDestination: firstId == destinationId,
      ));
    }

    if (destinationId.isNotEmpty && destinationId != firstId) {
      out.add(_OnBoardCheckpoint(
        stopId: destinationId,
        name: destinationName,
        isDestination: true,
      ));
    }

    return out;
  }

  Future<void> _toggleOnBoard(TripDetailData data) async {
    if (_onBoard) {
      _stopOnBoardMonitoring();
      return;
    }

    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) {
      if (!mounted) return;
      setState(() {
        _gpsBlocked = true;
        _onBoardAlert = 'Attiva il GPS per usare "Sono a bordo"';
      });
      return;
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      if (!mounted) return;
      setState(() {
        _gpsBlocked = true;
        _onBoardAlert = 'Permesso posizione non concesso';
      });
      return;
    }

    await ref.read(notificationServiceProvider).initialize();

    _positionSub?.cancel();
    if (!mounted) return;
    setState(() {
      _onBoard = true;
      _gpsBlocked = false;
      _gpsActive = false;
      _onBoardAlert = null;
      _lastNearbyCheckAt = null;
      _alertFiredStopIds.clear();
    });

    try {
      final current = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );
      await _handlePosition(current, data);
    } catch (_) {}

    _positionSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 25,
      ),
    ).listen(
      (position) {
        unawaited(_handlePosition(position, data));
      },
      onError: (_) {
        if (!mounted) return;
        setState(() {
          _gpsBlocked = true;
          _onBoardAlert = 'Posizione non disponibile';
        });
      },
    );
  }

  void _stopOnBoardMonitoring() {
    _positionSub?.cancel();
    _positionSub = null;

    if (!mounted) return;
    setState(() {
      _onBoard = false;
      _gpsActive = false;
      _gpsBlocked = false;
      _onBoardAlert = null;
      _lastNearbyCheckAt = null;
      _alertFiredStopIds.clear();
    });
  }

  Future<void> _handlePosition(Position position, TripDetailData data) async {
    if (!_onBoard || !mounted) return;

    final now = DateTime.now();
    final last = _lastNearbyCheckAt;
    if (last != null && now.difference(last) < const Duration(seconds: 12)) {
      if (!_gpsActive) {
        setState(() => _gpsActive = true);
      }
      return;
    }
    _lastNearbyCheckAt = now;

    if (!_gpsActive && mounted) {
      setState(() => _gpsActive = true);
    }

    final checkpoints = _checkpointsFromStops(data.stops);
    if (checkpoints.isEmpty) return;

    try {
      final nearby = await ref
          .read(stopsApiProvider)
          .nearby(position.latitude, position.longitude, radius: 0.35);
      final nearbyIds =
          nearby.map((s) => s.stopId).where((id) => id.isNotEmpty).toSet();

      _OnBoardCheckpoint? matched;
      for (final checkpoint in checkpoints) {
        if (nearbyIds.contains(checkpoint.stopId) &&
            !_alertFiredStopIds.contains(checkpoint.stopId)) {
          matched = checkpoint;
          break;
        }
      }

      if (matched == null) return;

      _alertFiredStopIds.add(matched.stopId);
      final title =
          matched.isDestination ? 'Preparati a scendere' : 'Fermata in arrivo';
      final body = matched.isDestination
          ? 'Stai per arrivare a ${matched.name}'
          : 'Sei vicino a ${matched.name}';

      await ref.read(notificationServiceProvider).showLocalNotification(
            id: matched.stopId.hashCode & 0x7fffffff,
            title: title,
            body: body,
            tag: 'onboard-${matched.stopId}',
          );

      if (!mounted) return;
      setState(() {
        _onBoardAlert = body;
      });
    } catch (_) {
      // errore rete temporaneo: riprova al prossimo tick
    }
  }

  @override
  void initState() {
    super.initState();
    _refreshTimer = Timer.periodic(const Duration(seconds: 20), (_) {
      ref.invalidate(tripDetailProvider(_request));
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _positionSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tripAsync = ref.watch(tripDetailProvider(_request));

    return Scaffold(
      backgroundColor: AppColors.surface3,
      appBar: AppBar(
        backgroundColor: AppColors.brand,
        foregroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        title: tripAsync.when(
          loading: () => const Text('Dettaglio corsa'),
          error: (_, __) => const Text('Dettaglio corsa'),
          data: (data) {
            // Costruisci titolo da fermata initiale → destinazione
            final stops = data.stops;
            final fromStop = widget.fromStop != null
                ? stops.firstWhere(
                    (s) => s['stopId']?.toString() == widget.fromStop,
                    orElse: () => const {},
                  )
                : (stops.firstWhere(
                    (s) => s['isFrom'] == true,
                    orElse: () => const {},
                  ));
            final toStop = widget.toStop != null
                ? stops.firstWhere(
                    (s) => s['stopId']?.toString() == widget.toStop,
                    orElse: () => const {},
                  )
                : (stops.firstWhere(
                    (s) => s['isTo'] == true,
                    orElse: () => const {},
                  ));
            final fromName = fromStop['stopName']?.toString() ??
                fromStop['stop_name']?.toString();
            final toName = toStop['stopName']?.toString() ??
                toStop['stop_name']?.toString();
            final routeShortName =
                (data.route['routeShortName'] ?? '?').toString();
            final routeColor = data.route['routeColor']?.toString();
            final routeTextColor = data.route['routeTextColor']?.toString();

            return Row(
              children: [
                RouteChip(
                  shortName: routeShortName,
                  color: routeColor,
                  textColor: routeTextColor,
                  small: true,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    fromName != null && toName != null
                        ? '$fromName → $toName'
                        : 'Dettaglio corsa',
                    style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        color: Colors.white),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            );
          },
        ),
      ),
      body: tripAsync.when(
        loading: () => ListView(
          padding: const EdgeInsets.all(16),
          children: List.generate(
            5,
            (_) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: LoadingShimmer.card(),
            ),
          ),
        ),
        error: (e, _) => _TripError(
          message: e.toString(),
          onRetry: () => ref.invalidate(tripDetailProvider(_request)),
        ),
        data: (data) => _TripContent(
          data: data,
          onBoard: _onBoard,
          gpsActive: _gpsActive,
          gpsBlocked: _gpsBlocked,
          onBoardAlert: _onBoardAlert,
          onToggleOnBoard: () => _toggleOnBoard(data),
        ),
      ),
    );
  }
}

class _TripContent extends StatelessWidget {
  final TripDetailData data;
  final bool onBoard;
  final bool gpsActive;
  final bool gpsBlocked;
  final String? onBoardAlert;
  final VoidCallback onToggleOnBoard;

  const _TripContent({
    required this.data,
    required this.onBoard,
    required this.gpsActive,
    required this.gpsBlocked,
    required this.onBoardAlert,
    required this.onToggleOnBoard,
  });

  @override
  Widget build(BuildContext context) {
    final route = data.route;
    final summary = data.summary;
    final stops = data.stops;
    final live = data.live;
    final tripIdForMap = (live?['tripId'] ?? data.tripId).toString();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            RouteChip(
              shortName: (route['routeShortName'] ?? '?').toString(),
              color: route['routeColor']?.toString(),
              textColor: route['routeTextColor']?.toString(),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                (route['headsign'] ?? route['routeLongName'] ?? '').toString(),
                style: const TextStyle(fontWeight: FontWeight.w700),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (summary['delayMinutes'] != null)
              DelayBadge(
                delaySeconds:
                    ((summary['delayMinutes'] as num).toInt() * 60),
                isRealtime: data.realtimeAvailable,
              ),
          ],
        ),
        const SizedBox(height: 12),
        _SummaryCard(summary: summary),
        const SizedBox(height: 12),
        if (live?['found'] == true) ...[
          _VehicleTracker(live: live!),
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: tripIdForMap.isEmpty
                ? null
                : () => context.push(
                      '/map?tripId=${Uri.encodeQueryComponent(tripIdForMap)}',
                    ),
            icon: const Icon(Icons.location_searching),
            label: const Text('Segui veicolo su mappa'),
          ),
          const SizedBox(height: 12),
        ] else if (live != null && live['found'] == false) ...[
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF3CD),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline, color: Color(0xFF856404)),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Posizione veicolo non disponibile',
                    style: TextStyle(color: Color(0xFF856404), fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Sono a bordo',
                  style: Theme.of(context)
                      .textTheme
                      .titleSmall
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                Text(
                  onBoard
                      ? 'Monitoraggio attivo: ti avvisiamo vicino alla prossima fermata e alla destinazione.'
                      : 'Attiva il monitoraggio per ricevere un avviso quando stai per scendere.',
                  style: const TextStyle(fontSize: 13, color: AppColors.text2),
                ),
                const SizedBox(height: 10),
                FilledButton.tonalIcon(
                  onPressed: onToggleOnBoard,
                  icon: Icon(onBoard
                      ? Icons.stop_circle_outlined
                      : Icons.directions_bus),
                  label: Text(onBoard ? 'Fine monitoraggio' : 'Sono a bordo'),
                ),
                if (gpsBlocked) ...[
                  const SizedBox(height: 8),
                  const Text(
                    'GPS o permessi posizione non disponibili.',
                    style: TextStyle(fontSize: 12, color: AppColors.delayHeavy),
                  ),
                ] else if (onBoard && !gpsActive) ...[
                  const SizedBox(height: 8),
                  const Text(
                    'Attendo posizione GPS…',
                    style: TextStyle(fontSize: 12, color: AppColors.text3),
                  ),
                ],
                if (onBoardAlert != null && onBoardAlert!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.brand.withAlpha(25),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      onBoardAlert!,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.text1,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'Fermate (${stops.length})',
          style: Theme.of(context)
              .textTheme
              .titleSmall
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        ...List.generate(
          stops.length,
          (i) => _StopTile(stop: stops[i], isLast: i == stops.length - 1),
        ),
        const SizedBox(height: 12),
        Text(
          data.realtimeAvailable
              ? 'Aggiornamento realtime attivo'
              : 'Mostrando orari programmati',
          style: TextStyle(
            fontSize: 12,
            color: data.realtimeAvailable ? AppColors.onTime : AppColors.text3,
          ),
        ),
      ],
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final Map<String, dynamic> summary;
  const _SummaryCard({required this.summary});

  @override
  Widget build(BuildContext context) {
    final total = summary['totalStops'] ?? 0;
    final passed = summary['passedStops'] ?? 0;
    final remaining = summary['remainingStops'] ?? 0;
    final delay = summary['delayMinutes'];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Wrap(
          spacing: 16,
          runSpacing: 8,
          children: [
            _Metric(label: 'Totali', value: '$total'),
            _Metric(label: 'Percorse', value: '$passed'),
            _Metric(label: 'Rimanenti', value: '$remaining'),
            if (delay != null)
              _Metric(
                label: 'Ritardo',
                value: delay == 0
                    ? 'On time'
                    : (delay > 0 ? '+$delay min' : '$delay min'),
              ),
          ],
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  final String label;
  final String value;
  const _Metric({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(fontSize: 12, color: AppColors.text3)),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
      ],
    );
  }
}

class _VehicleTracker extends StatelessWidget {
  final Map<String, dynamic> live;
  const _VehicleTracker({required this.live});

  Color _delayColor(int? delay) {
    if (delay == null) return AppColors.text3;
    if (delay <= 0) return AppColors.onTime;
    if (delay <= 2) return AppColors.delayLight;
    if (delay <= 5) return const Color(0xFFD97706);
    return AppColors.delayHeavy;
  }

  String _delayLabel(int? delay) {
    if (delay == null) return '';
    if (delay == 0) return 'In orario';
    if (delay < 0) return '${delay.abs()} min anticipo';
    return '+$delay min ritardo';
  }

  String _statusLabel(String? s) {
    switch (s?.toUpperCase()) {
      case 'IN_TRANSIT_TO':
        return 'In transito';
      case 'STOPPED_AT':
        return 'Fermato';
      case 'INCOMING_AT':
        return 'In arrivo';
      default:
        return s ?? '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final vehicle = (live['vehicle'] as Map?)?.cast<String, dynamic>();
    final currentStop = (live['currentStop'] as Map?)?.cast<String, dynamic>();
    final nextStop = (live['nextStop'] as Map?)?.cast<String, dynamic>();
    final progress = live['progress'];
    final isRealtime = live['isRealtime'] == true;
    final estimatedAt = live['estimatedAt']?.toString();
    final summary = (live['summary'] as Map?)?.cast<String, dynamic>() ?? {};
    final delayMinutes = (summary['delayMinutes'] ?? vehicle?['delay']) as int?;
    final remainingStops = summary['remainingStops'] as int?;
    final speed = vehicle?['speed'] as num?;
    final occupancy = vehicle?['occupancy']?.toString();
    final status = vehicle?['currentStatus']?.toString();

    DateTime? updatedAt;
    if (estimatedAt != null) {
      updatedAt = DateTime.tryParse(estimatedAt);
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: isRealtime ? AppColors.onTime : AppColors.delayLight,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  isRealtime ? 'Posizione GPS live' : 'Posizione stimata',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: isRealtime ? AppColors.onTime : AppColors.delayLight,
                    fontSize: 13,
                  ),
                ),
                if (delayMinutes != null) ...[
                  const Spacer(),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _delayColor(delayMinutes).withAlpha(30),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      _delayLabel(delayMinutes),
                      style: TextStyle(
                        color: _delayColor(delayMinutes),
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ],
            ),
            if (currentStop != null || nextStop != null) ...[
              const SizedBox(height: 10),
              if (currentStop?['name'] != null)
                Row(
                  children: [
                    const Icon(Icons.radio_button_checked,
                        size: 14, color: AppColors.brand),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Attuale: ${currentStop!['name']}',
                        style: const TextStyle(fontSize: 13),
                      ),
                    ),
                  ],
                ),
              if (nextStop?['name'] != null)
                Row(
                  children: [
                    const Icon(Icons.radio_button_unchecked,
                        size: 14, color: AppColors.text3),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Prossima: ${nextStop!['name']}',
                        style: const TextStyle(
                            fontSize: 13, color: AppColors.text2),
                      ),
                    ),
                  ],
                ),
            ],
            if (progress != null) ...[
              const SizedBox(height: 8),
              LinearProgressIndicator(
                value: ((progress as num).toDouble() / 100).clamp(0, 1),
                backgroundColor: AppColors.brand.withAlpha(30),
                valueColor:
                    const AlwaysStoppedAnimation<Color>(AppColors.brand),
              ),
            ],
            const SizedBox(height: 10),
            Wrap(
              spacing: 14,
              runSpacing: 6,
              children: [
                if (speed != null)
                  _LiveChip(
                      icon: Icons.speed,
                      label: '${speed.toStringAsFixed(0)} km/h'),
                if (occupancy != null && occupancy.isNotEmpty)
                  _LiveChip(icon: Icons.people, label: occupancy),
                if (status != null && status.isNotEmpty)
                  _LiveChip(
                      icon: Icons.info_outline, label: _statusLabel(status)),
                if (remainingStops != null)
                  _LiveChip(
                      icon: Icons.flag,
                      label: '$remainingStops fermate rimanenti'),
              ],
            ),
            if (updatedAt != null) ...[
              const SizedBox(height: 6),
              Text(
                'Posizione rilevata alle '
                '${updatedAt.hour.toString().padLeft(2, '0')}:'
                '${updatedAt.minute.toString().padLeft(2, '0')}:'
                '${updatedAt.second.toString().padLeft(2, '0')}',
                style: const TextStyle(fontSize: 11, color: AppColors.text3),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _LiveChip extends StatelessWidget {
  final IconData icon;
  final String label;
  const _LiveChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: AppColors.text3),
          const SizedBox(width: 4),
          Text(label,
              style: const TextStyle(fontSize: 12, color: AppColors.text2)),
        ],
      );
}

class _StopTile extends StatelessWidget {
  final Map<String, dynamic> stop;
  final bool isLast;
  const _StopTile({required this.stop, this.isLast = false});

  @override
  Widget build(BuildContext context) {
    final status = (stop['status'] ?? '').toString();
    final isCurrent = status == 'current';
    final isPassed = status == 'passed';
    final dotColor = isCurrent
        ? AppColors.brand
        : isPassed
            ? AppColors.text3
            : AppColors.text2;
    final stopId = stop['stopId']?.toString();

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 28,
            child: Column(
              children: [
                Icon(
                  isCurrent
                      ? Icons.radio_button_checked
                      : isPassed
                          ? Icons.check_circle
                          : Icons.radio_button_unchecked,
                  color: dotColor,
                  size: 16,
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 2),
                      color: AppColors.text3.withAlpha(80),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: GestureDetector(
              onTap: stopId != null && stopId.isNotEmpty
                  ? () =>
                      context.push('/stops/${Uri.encodeComponent(stopId)}')
                  : null,
              child: Padding(
                padding: EdgeInsets.only(bottom: isLast ? 0 : 12),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            (stop['stopName'] ?? '').toString(),
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: isCurrent
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                              color: isPassed
                                  ? AppColors.text3
                                  : AppColors.text1,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${stop['arrivalTime'] ?? '--:--'} · ${stop['departureTime'] ?? '--:--'}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.text3,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (stopId != null && stopId.isNotEmpty)
                      const Icon(Icons.chevron_right,
                          size: 16, color: AppColors.text3),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TripError extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _TripError({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline,
                size: 48, color: AppColors.delayHeavy),
            const SizedBox(height: 12),
            Text(
              'Impossibile caricare la corsa',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 6),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.text3),
            ),
            const SizedBox(height: 12),
            FilledButton(onPressed: onRetry, child: const Text('Riprova')),
          ],
        ),
      ),
    );
  }
}
