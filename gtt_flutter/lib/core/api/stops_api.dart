import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/stop.dart';
import 'api_client.dart';

class StopsApi {
  final Dio _dio;
  const StopsApi(this._dio);

  Future<List<Stop>> search(String query) async {
    final res = await _dio.get('/stops/search', queryParameters: {'q': query});
    final list = (res.data['stops'] ?? res.data) as List;
    return list.map((e) => Stop.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<Stop>> nearby(double lat, double lon,
      {double radius = 0.5}) async {
    final res = await _dio.get('/stops/nearby',
        queryParameters: {'lat': lat, 'lon': lon, 'radius': radius});
    final list = (res.data['stops'] ?? res.data) as List;
    return list.map((e) => Stop.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Stop> getById(String stopId) async {
    final res = await _dio.get('/stops/$stopId');
    final data = res.data as Map<String, dynamic>;

    // Compatibilità con backend che restituisce:
    // 1) stop flat
    // 2) { stop: {...}, routes: [...] }
    if (data['stop'] is Map<String, dynamic>) {
      final stopMap = Map<String, dynamic>.from(
        data['stop'] as Map<String, dynamic>,
      );
      if (data['routes'] is List) {
        stopMap['routes'] = data['routes'];
      }
      return Stop.fromJson(stopMap);
    }

    return Stop.fromJson(data);
  }

  Future<List<PlaceResult>> searchPlaces(String query, {int limit = 6}) async {
    final res = await _dio.get(
      '/stops/places',
      queryParameters: {'q': query, 'limit': limit},
    );
    final list = (res.data['places'] ?? const []) as List;
    return list
        .map((e) => PlaceResult.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

class PlaceResult {
  final String name;
  final String? fullName;
  final double lat;
  final double lon;
  final String? type;

  const PlaceResult({
    required this.name,
    required this.lat,
    required this.lon,
    this.fullName,
    this.type,
  });

  factory PlaceResult.fromJson(Map<String, dynamic> json) => PlaceResult(
        name: (json['name'] ?? '').toString(),
        fullName: json['fullName']?.toString(),
        lat: (json['lat'] ?? 0).toDouble(),
        lon: (json['lon'] ?? 0).toDouble(),
        type: json['type']?.toString(),
      );
}

final stopsApiProvider = Provider<StopsApi>(
  (ref) => StopsApi(ref.watch(dioProvider)),
);
