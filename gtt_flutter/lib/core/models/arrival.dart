class Arrival {
  final String routeId;
  final String routeShortName;
  final String? routeColor;
  final String? routeTextColor;
  final String headsign;
  final String scheduledTime;
  final String? realtimeTime;
  final bool isRealtime;
  final int? delaySeconds;
  final String? tripId;
  final String? vehicleId;

  const Arrival({
    required this.routeId,
    required this.routeShortName,
    required this.headsign,
    required this.scheduledTime,
    required this.isRealtime,
    this.routeColor,
    this.routeTextColor,
    this.realtimeTime,
    this.delaySeconds,
    this.tripId,
    this.vehicleId,
  });

  String get displayTime => realtimeTime ?? scheduledTime;

  int get delayMinutes => ((delaySeconds ?? 0) / 60).round();

  bool get isLate => (delaySeconds ?? 0) > 60;
  bool get isEarly => (delaySeconds ?? 0) < -30;
  bool get isOnTime => !isLate && !isEarly;

  factory Arrival.fromJson(Map<String, dynamic> json) => Arrival(
        routeId: json['routeId'] ?? '',
        routeShortName: json['routeShortName'] ?? json['shortName'] ?? '',
        routeColor: json['routeColor'] ?? json['color'],
        routeTextColor: json['routeTextColor'] ?? json['textColor'],
        headsign: json['headsign'] ?? json['tripHeadsign'] ?? '',
        scheduledTime: json['scheduledTime'] ?? json['departureTime'] ?? '',
        realtimeTime: json['realtimeTime'],
        isRealtime: json['isRealtime'] as bool? ?? false,
        delaySeconds: json['delaySeconds'],
        tripId: json['tripId'],
        vehicleId: json['vehicleId'],
      );
}
