class RouteLine {
  final String routeId;
  final String shortName;
  final String longName;
  final String? color;
  final String? textColor;
  final int routeType;

  const RouteLine({
    required this.routeId,
    required this.shortName,
    required this.longName,
    this.color,
    this.textColor,
    required this.routeType,
  });

  factory RouteLine.fromJson(Map<String, dynamic> json) => RouteLine(
        routeId: json['routeId'] ?? json['route_id'] ?? '',
        shortName: json['shortName'] ?? json['route_short_name'] ?? '',
        longName: json['longName'] ?? json['route_long_name'] ?? '',
        color: json['color'] ?? json['route_color'],
        textColor: json['textColor'] ?? json['route_text_color'],
        routeType: (json['routeType'] ?? json['route_type'] ?? 3) as int,
      );

  Map<String, dynamic> toJson() => {
        'routeId': routeId,
        'shortName': shortName,
        'longName': longName,
        'color': color,
        'textColor': textColor,
        'routeType': routeType,
      };
}
