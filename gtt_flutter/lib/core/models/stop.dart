import 'route_line.dart';

class Stop {
  final String stopId;
  final String stopCode;
  final String stopName;
  final double stopLat;
  final double stopLon;
  final List<RouteLine> routes;
  final int? distanceM;

  const Stop({
    required this.stopId,
    required this.stopCode,
    required this.stopName,
    required this.stopLat,
    required this.stopLon,
    required this.routes,
    this.distanceM,
  });

  factory Stop.fromJson(Map<String, dynamic> json) => Stop(
        stopId: json['stopId'] ?? json['stop_id'] ?? '',
        stopCode: json['stopCode'] ?? json['stop_code'] ?? '',
        stopName: json['stopName'] ?? json['stop_name'] ?? '',
        stopLat: (json['stopLat'] ?? json['stop_lat'] ?? 0).toDouble(),
        stopLon: (json['stopLon'] ?? json['stop_lon'] ?? 0).toDouble(),
        routes: (json['routes'] as List? ?? [])
            .map((r) => RouteLine.fromJson(r as Map<String, dynamic>))
            .toList(),
        distanceM: json['distanceM'],
      );

  Map<String, dynamic> toJson() => {
        'stopId': stopId,
        'stopCode': stopCode,
        'stopName': stopName,
        'stopLat': stopLat,
        'stopLon': stopLon,
        'routes': routes.map((r) => r.toJson()).toList(),
        if (distanceM != null) 'distanceM': distanceM,
      };
}
