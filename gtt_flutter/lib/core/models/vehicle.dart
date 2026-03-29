class Vehicle {
  final String vehicleId;
  final String? tripId;
  /// trip_id GTFS statico (diverso da tripId che è l'ID operativo MQTT)
  final String? gtfsTripId;
  final String? routeId;
  final String? routeShortName;
  final String? routeColor;
  final double lat;
  final double lon;
  final int? bearing;
  final int? speed;
  final String? headsign;
  final DateTime? lastUpdated;
  final int? routeType;
  final String? currentStatus;

  const Vehicle({
    required this.vehicleId,
    required this.lat,
    required this.lon,
    this.tripId,
    this.gtfsTripId,
    this.routeId,
    this.routeShortName,
    this.routeColor,
    this.bearing,
    this.speed,
    this.headsign,
    this.lastUpdated,
    this.routeType,
    this.currentStatus,
  });

  factory Vehicle.fromJson(Map<String, dynamic> json) => Vehicle(
        vehicleId: json['vehicleId'] ?? json['vehicle_id'] ?? '',
        tripId: json['tripId'] ?? json['trip_id'],
        gtfsTripId: json['gtfsTripId'],
        routeId: json['routeId'] ?? json['route_id'],
        routeShortName: json['routeShortName'] ?? json['shortName'],
        routeColor: json['routeColor'] ?? json['color'],
        lat: (json['lat'] ?? json['latitude'] ?? 0).toDouble(),
        lon: (json['lon'] ?? json['longitude'] ?? 0).toDouble(),
        bearing: json['bearing'],
        speed: json['speed'],
        headsign: json['headsign'],
        lastUpdated: json['lastUpdated'] != null
            ? DateTime.tryParse(json['lastUpdated'].toString())
            : null,
        routeType: json['routeType'] ?? json['route_type'],
        currentStatus: json['currentStatus'] ?? json['current_status'],
      );
}
