import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/route_line.dart';
import 'api_client.dart';

class LinesApi {
  final Dio _dio;
  const LinesApi(this._dio);

  Future<List<RouteLine>> getAll({int? type}) async {
    final params = <String, dynamic>{};
    if (type != null) params['type'] = type;
    final res = await _dio.get('/lines', queryParameters: params);
    final raw = (res.data['lines'] ?? res.data) as List;
    final flattened = <Map<String, dynamic>>[];
    for (final item in raw) {
      final map = (item as Map).cast<String, dynamic>();
      final routes = map['routes'];
      if (routes is List) {
        for (final r in routes) {
          flattened.add((r as Map).cast<String, dynamic>());
        }
      } else {
        flattened.add(map);
      }
    }
    return flattened.map(RouteLine.fromJson).toList();
  }

  Future<RouteLine> getById(String routeId) async {
    final res = await _dio.get('/lines/$routeId');
    final data = res.data as Map<String, dynamic>;
    if (data['route'] is Map<String, dynamic>) {
      return RouteLine.fromJson(data['route'] as Map<String, dynamic>);
    }
    return RouteLine.fromJson(data);
  }

  Future<Map<String, dynamic>> getDetailRaw(String routeId) async {
    final res = await _dio.get('/lines/$routeId');
    return (res.data as Map).cast<String, dynamic>();
  }
}

final linesApiProvider = Provider<LinesApi>(
  (ref) => LinesApi(ref.watch(dioProvider)),
);
