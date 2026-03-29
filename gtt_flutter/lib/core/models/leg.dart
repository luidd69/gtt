import 'stop.dart';

enum LegMode { walk, transit, bicycle }

class IntermediateStop {
  final String stopId;
  final String stopName;
  final double? lat;
  final double? lon;
  final String? arrivalTime;
  final String? departureTime;

  const IntermediateStop({
    required this.stopId,
    required this.stopName,
    this.lat,
    this.lon,
    this.arrivalTime,
    this.departureTime,
  });

  factory IntermediateStop.fromJson(Map<String, dynamic> json) =>
      IntermediateStop(
        stopId: json['stopId'] ?? '',
        stopName: json['stopName'] ?? '',
        lat: (json['lat'] is num) ? (json['lat'] as num).toDouble() : null,
        lon: (json['lon'] is num) ? (json['lon'] as num).toDouble() : null,
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
  final bool realtime;
  final Stop? fromStop;
  final Stop? toStop;
  final List<IntermediateStop> intermediateStops;

  // Walk-only fields
  final List<List<double>>? polyline;

  // Encoded polyline (Google format) se disponibile da OTP
  final String? encodedPolyline;

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
    this.realtime = false,
    this.fromStop,
    this.toStop,
    this.intermediateStops = const [],
    this.polyline,
    this.encodedPolyline,
  });

  bool get isTransit => mode == LegMode.transit;
  bool get isWalk => mode == LegMode.walk;

  factory Leg.fromJson(Map<String, dynamic> json) {
    final modeStr = (json['mode'] ?? 'WALK').toString().toUpperCase();
    final isWalk = modeStr == 'WALK';
    final mode = isWalk ? LegMode.walk : LegMode.transit;
    final route = json['route'] as Map<String, dynamic>?;
    final fromRaw = (json['fromStop'] ?? json['from']) as Map<String, dynamic>?;
    final toRaw = (json['toStop'] ?? json['to']) as Map<String, dynamic>?;
    return Leg(
      mode: mode,
      startTime: json['startTime'] ?? '',
      endTime: json['endTime'] ?? '',
      durationSeconds: (json['durationSeconds'] ??
              json['duration'] ??
              ((json['durationMin'] ?? 0) as num) * 60)
          .toInt(),
      distanceM: (json['distanceM'] ?? json['distance'] ?? 0).toDouble(),
      routeId: json['routeId'] ?? route?['routeId'],
      routeShortName:
          json['routeShortName'] ?? json['shortName'] ?? route?['shortName'],
      routeColor: json['routeColor'] ?? json['color'] ?? route?['color'],
      routeTextColor:
          json['routeTextColor'] ?? json['textColor'] ?? route?['textColor'],
      headsign: json['headsign'] ?? json['tripHeadsign'],
      tripId: json['tripId'],
      realtime: json['realTime'] as bool? ??
          (json['dataType']?.toString().toLowerCase() == 'realtime'),
      fromStop: fromRaw != null
          ? Stop.fromJson({
              'stopId': fromRaw['stopId'],
              'stopCode': fromRaw['stopCode'],
              'stopName': fromRaw['stopName'] ?? fromRaw['name'],
              'stopLat': fromRaw['stopLat'] ?? fromRaw['lat'],
              'stopLon': fromRaw['stopLon'] ?? fromRaw['lon'],
              'routes': const [],
            })
          : null,
      toStop: toRaw != null
          ? Stop.fromJson({
              'stopId': toRaw['stopId'],
              'stopCode': toRaw['stopCode'],
              'stopName': toRaw['stopName'] ?? toRaw['name'],
              'stopLat': toRaw['stopLat'] ?? toRaw['lat'],
              'stopLon': toRaw['stopLon'] ?? toRaw['lon'],
              'routes': const [],
            })
          : null,
      intermediateStops: (json['intermediateStops'] as List? ?? [])
          .map((s) => IntermediateStop.fromJson({
                'stopId': (s as Map<String, dynamic>)['stopId'] ?? s['id'],
                'stopName': s['stopName'] ?? s['name'],
                'arrivalTime': s['arrivalTime'],
                'departureTime': s['departureTime'],
              }))
          .toList(),
      encodedPolyline: json['encodedPolyline'] as String?,
    );
  }
}
