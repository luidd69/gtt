import 'leg.dart';

class Itinerary {
  final String departureTime;
  final String arrivalTime;
  final int durationSeconds;
  final int transfers;
  final List<Leg> legs;
  final bool fastest;
  final bool fewestTransfers;

  const Itinerary({
    required this.departureTime,
    required this.arrivalTime,
    required this.durationSeconds,
    required this.transfers,
    required this.legs,
    this.fastest = false,
    this.fewestTransfers = false,
  });

  int get durationMinutes => (durationSeconds / 60).round();

  factory Itinerary.fromJson(Map<String, dynamic> json) => Itinerary(
        departureTime: json['departureTime'] ?? '',
        arrivalTime: json['arrivalTime'] ?? '',
        durationSeconds: (json['durationSeconds'] ?? json['duration'] ?? 0) as int,
        transfers: (json['transfers'] ?? 0) as int,
        legs: (json['legs'] as List? ?? [])
            .map((l) => Leg.fromJson(l as Map<String, dynamic>))
            .toList(),
        fastest: json['fastest'] as bool? ?? false,
        fewestTransfers: json['fewestTransfers'] as bool? ?? false,
      );
}
