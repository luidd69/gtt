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
    final list = (res.data['lines'] ?? res.data) as List;
    return list.map((e) => RouteLine.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<RouteLine> getById(String routeId) async {
    final res = await _dio.get('/lines/$routeId');
    return RouteLine.fromJson(res.data as Map<String, dynamic>);
  }
}

final linesApiProvider = Provider<LinesApi>(
  (ref) => LinesApi(ref.watch(dioProvider)),
);
