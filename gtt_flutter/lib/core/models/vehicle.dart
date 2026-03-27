class Vehicle {
  final String vehicleId;
  final String? tripId;
  final String? routeId;
  final String? routeShortName;
  final String? routeColor;
  final double lat;
  final double lon;
  final int? bearing;
  final int? speed;
  final String? headsign;
  final DateTime? lastUpdated;

  const Vehicle({
    required this.vehicleId,
    required this.lat,
    required this.lon,
    this.tripId,
    this.routeId,
    this.routeShortName,
    this.routeColor,
    this.bearing,
    this.speed,
    this.headsign,
    this.lastUpdated,
  });

  factory Vehicle.fromJson(Map<String, dynamic> json) => Vehicle(
        vehicleId: json['vehicleId'] ?? json['vehicle_id'] ?? '',
        tripId: json['tripId'] ?? json['trip_id'],
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
      );
}
