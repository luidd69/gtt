class Reminder {
  final String id;
  final String stopId;
  final String stopName;
  final String routeShortName;
  final String scheduledTime;
  final int minutesBefore;
  final int fireAt; // timestamp ms
  final bool sent;

  const Reminder({
    required this.id,
    required this.stopId,
    required this.stopName,
    required this.routeShortName,
    required this.scheduledTime,
    required this.minutesBefore,
    required this.fireAt,
    this.sent = false,
  });

  factory Reminder.fromJson(Map<String, dynamic> json) => Reminder(
        id: json['id'] ?? '',
        stopId: json['stopId'] ?? '',
        stopName: json['stopName'] ?? '',
        routeShortName: json['routeShortName'] ?? '',
        scheduledTime: json['scheduledTime'] ?? '',
        minutesBefore: (json['minutesBefore'] ?? 5) as int,
        fireAt: (json['fireAt'] ?? 0) as int,
        sent: json['sent'] as bool? ?? false,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'stopId': stopId,
        'stopName': stopName,
        'routeShortName': routeShortName,
        'scheduledTime': scheduledTime,
        'minutesBefore': minutesBefore,
        'fireAt': fireAt,
        'sent': sent,
      };

  Reminder copyWith({bool? sent}) => Reminder(
        id: id,
        stopId: stopId,
        stopName: stopName,
        routeShortName: routeShortName,
        scheduledTime: scheduledTime,
        minutesBefore: minutesBefore,
        fireAt: fireAt,
        sent: sent ?? this.sent,
      );

  Duration get timeUntilFire =>
      DateTime.fromMillisecondsSinceEpoch(fireAt).difference(DateTime.now());
}
