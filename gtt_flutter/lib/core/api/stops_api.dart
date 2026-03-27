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

  Future<List<Stop>> nearby(double lat, double lon, {double radius = 0.5}) async {
    final res = await _dio.get('/stops/nearby',
        queryParameters: {'lat': lat, 'lon': lon, 'radius': radius});
    final list = (res.data['stops'] ?? res.data) as List;
    return list.map((e) => Stop.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Stop> getById(String stopId) async {
    final res = await _dio.get('/stops/$stopId');
    return Stop.fromJson(res.data as Map<String, dynamic>);
  }
}

final stopsApiProvider = Provider<StopsApi>(
  (ref) => StopsApi(ref.watch(dioProvider)),
);
