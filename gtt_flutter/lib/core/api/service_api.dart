import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/vehicle.dart';
import 'api_client.dart';

class ServiceAlert {
  final String id;
  final String title;
  final String? description;
  final String? url;
  final String? effect;

  const ServiceAlert({
    required this.id,
    required this.title,
    this.description,
    this.url,
    this.effect,
  });

  factory ServiceAlert.fromJson(Map<String, dynamic> json) => ServiceAlert(
        id: json['id'] ?? '',
        title: json['header'] ?? json['title'] ?? json['headerText'] ?? '',
        description: json['description'] ?? json['descriptionText'],
        url: json['url'],
        effect: json['effect'],
      );
}

class ServiceStatus {
  final List<ServiceAlert> alerts;
  final bool gtfsLoaded;
  final String? gtfsLastUpdated;

  const ServiceStatus({
    required this.alerts,
    required this.gtfsLoaded,
    this.gtfsLastUpdated,
  });

  factory ServiceStatus.fromJson(Map<String, dynamic> json) => ServiceStatus(
        alerts: (json['alerts'] as List? ?? [])
            .map((a) => ServiceAlert.fromJson(a as Map<String, dynamic>))
            .toList(),
        gtfsLoaded:
            json['available'] as bool? ?? json['gtfsLoaded'] as bool? ?? false,
        gtfsLastUpdated: json['gtfsLastUpdated'],
      );
}

class ServiceApi {
  final Dio _dio;
  const ServiceApi(this._dio);

  Future<ServiceStatus> getStatus() async {
    final res = await _dio.get('/service/status');
    return ServiceStatus.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<Vehicle>> getVehicles() async {
    final res = await _dio.get('/service/vehicles');
    final list = (res.data['vehicles'] ?? res.data) as List;
    return list
        .map((e) => Vehicle.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<GtfsInfo> getGtfsInfo() async {
    final res = await _dio.get('/service/gtfs-info');
    return GtfsInfo.fromJson((res.data as Map).cast<String, dynamic>());
  }

  Future<Map<String, dynamic>> getMetroInfo() async {
    final res = await _dio.get('/service/metro');
    return (res.data as Map).cast<String, dynamic>();
  }
}

class GtfsInfo {
  final bool loaded;
  final String? loadedAt;
  final int? stops;
  final int? routes;
  final int? trips;
  final int? stopTimes;
  final bool? realtimeEnabled;

  const GtfsInfo({
    required this.loaded,
    this.loadedAt,
    this.stops,
    this.routes,
    this.trips,
    this.stopTimes,
    this.realtimeEnabled,
  });

  factory GtfsInfo.fromJson(Map<String, dynamic> json) {
    final stats = (json['stats'] as Map?)?.cast<String, dynamic>() ?? const {};
    return GtfsInfo(
      loaded: json['loaded'] as bool? ?? false,
      loadedAt: json['loadedAt']?.toString(),
      stops: (stats['stops'] as num?)?.toInt(),
      routes: (stats['routes'] as num?)?.toInt(),
      trips: (stats['trips'] as num?)?.toInt(),
      stopTimes: (stats['stopTimes'] as num?)?.toInt(),
      realtimeEnabled: json['realtimeEnabled'] as bool?,
    );
  }
}

final serviceApiProvider = Provider<ServiceApi>(
  (ref) => ServiceApi(ref.watch(dioProvider)),
);
