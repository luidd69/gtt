import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';

class TripsApi {
  final Dio _dio;
  const TripsApi(this._dio);

  Future<Map<String, dynamic>> getTripLive(String tripId) async {
    final res = await _dio.get('/trips/$tripId/live');
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getTripDetail(
    String tripId, {
    String? fromStop,
    String? toStop,
  }) async {
    final params = <String, dynamic>{};
    if (fromStop != null) params['fromStop'] = fromStop;
    if (toStop != null) params['toStop'] = toStop;
    final res =
        await _dio.get('/journey/trip/$tripId', queryParameters: params);
    return res.data as Map<String, dynamic>;
  }
}

final tripsApiProvider = Provider<TripsApi>(
  (ref) => TripsApi(ref.watch(dioProvider)),
);
