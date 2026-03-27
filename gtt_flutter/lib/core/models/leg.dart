import 'stop.dart';
import 'route_line.dart';

enum LegMode { walk, transit, bicycle }

class IntermediateStop {
  final String stopId;
  final String stopName;
  final String? arrivalTime;
  final String? departureTime;

  const IntermediateStop({
    required this.stopId,
    required this.stopName,
    this.arrivalTime,
    this.departureTime,
  });

  factory IntermediateStop.fromJson(Map<String, dynamic> json) =>
      IntermediateStop(
        stopId: json['stopId'] ?? '',
        stopName: json['stopName'] ?? '',
        arrivalTime: json['arrivalTime'],
        departureTime: json['departureTime'],
      );
}

class Leg {
  final LegMode mode;
  final String startTime;
  final String endTime;
  final int durationSeconds;
  final double distanceM;

  // Transit-only fields
  final String? routeId;
  final String? routeShortName;
  final String? routeColor;
  final String? routeTextColor;
  final String? headsign;
  final String? tripId;
  final Stop? fromStop;
  final Stop? toStop;
  final List<IntermediateStop> intermediateStops;

  // Walk-only fields
  final List<List<double>>? polyline;

  const Leg({
    required this.mode,
    required this.startTime,
    required this.endTime,
    required this.durationSeconds,
    required this.distanceM,
    this.routeId,
    this.routeShortName,
    this.routeColor,
    this.routeTextColor,
    this.headsign,
    this.tripId,
    this.fromStop,
    this.toStop,
    this.intermediateStops = const [],
    this.polyline,
  });

  bool get isTransit => mode == LegMode.transit;
  bool get isWalk => mode == LegMode.walk;

  factory Leg.fromJson(Map<String, dynamic> json) {
    final modeStr = (json['mode'] ?? 'WALK').toString().toUpperCase();
    final mode = modeStr == 'WALK' ? LegMode.walk : LegMode.transit;
    return Leg(
      mode: mode,
      startTime: json['startTime'] ?? '',
      endTime: json['endTime'] ?? '',
      durationSeconds: (json['durationSeconds'] ?? json['duration'] ?? 0) as int,
      distanceM: (json['distanceM'] ?? json['distance'] ?? 0).toDouble(),
      routeId: json['routeId'],
      routeShortName: json['routeShortName'] ?? json['shortName'],
      routeColor: json['routeColor'] ?? json['color'],
      routeTextColor: json['routeTextColor'] ?? json['textColor'],
      headsign: json['headsign'] ?? json['tripHeadsign'],
      tripId: json['tripId'],
      fromStop: json['fromStop'] != null ? Stop.fromJson(json['fromStop']) : null,
      toStop: json['toStop'] != null ? Stop.fromJson(json['toStop']) : null,
      intermediateStops: (json['intermediateStops'] as List? ?? [])
          .map((s) => IntermediateStop.fromJson(s as Map<String, dynamic>))
          .toList(),
    );
  }
}
