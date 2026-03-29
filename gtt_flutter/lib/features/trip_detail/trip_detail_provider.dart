import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/trips_api.dart';

class TripDetailRequest {
  final String tripId;
  final String? fromStop;
  final String? toStop;

  const TripDetailRequest({
    required this.tripId,
    this.fromStop,
    this.toStop,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TripDetailRequest &&
          runtimeType == other.runtimeType &&
          tripId == other.tripId &&
          fromStop == other.fromStop &&
          toStop == other.toStop;

  @override
  int get hashCode => Object.hash(tripId, fromStop, toStop);
}

class TripDetailData {
  final String tripId;
  final Map<String, dynamic> route;
  final List<Map<String, dynamic>> stops;
  final Map<String, dynamic> summary;
  final bool realtimeAvailable;
  final Map<String, dynamic>? live;

  const TripDetailData({
    required this.tripId,
    required this.route,
    required this.stops,
    required this.summary,
    required this.realtimeAvailable,
    required this.live,
  });

  factory TripDetailData.fromMaps(
    Map<String, dynamic> detail,
    Map<String, dynamic>? live,
  ) {
    return TripDetailData(
      tripId: (detail['tripId'] ?? '').toString(),
      route: (detail['route'] as Map<String, dynamic>? ?? const {}),
      stops: ((detail['stops'] as List?) ?? const [])
          .map((e) => (e as Map).cast<String, dynamic>())
          .toList(),
      summary: (detail['summary'] as Map<String, dynamic>? ?? const {}),
      realtimeAvailable: detail['realtimeAvailable'] as bool? ?? false,
      live: live,
    );
  }
}

final tripDetailProvider = FutureProvider.autoDispose
    .family<TripDetailData, TripDetailRequest>((ref, req) async {
  final api = ref.watch(tripsApiProvider);
  final detail = await api.getTripDetail(
    req.tripId,
    fromStop: req.fromStop,
    toStop: req.toStop,
  );
  if (detail['error'] != null) {
    throw Exception(detail['error'].toString());
  }

  final resolvedTripId = (detail['tripId'] as String?)?.trim();
  final liveTripId = (resolvedTripId != null && resolvedTripId.isNotEmpty)
      ? resolvedTripId
      : req.tripId;

  Map<String, dynamic>? live;
  try {
    live = await api.getTripLive(liveTripId);
  } catch (_) {
    live = null;
  }
  return TripDetailData.fromMaps(detail, live);
});
