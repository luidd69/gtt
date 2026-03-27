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
        title: json['title'] ?? json['headerText'] ?? '',
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
        gtfsLoaded: json['gtfsLoaded'] as bool? ?? false,
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
    return list.map((e) => Vehicle.fromJson(e as Map<String, dynamic>)).toList();
  }
}

final serviceApiProvider = Provider<ServiceApi>(
  (ref) => ServiceApi(ref.watch(dioProvider)),
);
