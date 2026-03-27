import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/arrival.dart';
import 'api_client.dart';

class ArrivalsApi {
  final Dio _dio;
  const ArrivalsApi(this._dio);

  Future<List<Arrival>> getArrivals(
    String stopId, {
    int limit = 20,
    String? date,
    String? time,
  }) async {
    final params = <String, dynamic>{'limit': limit};
    if (date != null) params['date'] = date;
    if (time != null) params['time'] = time;
    final res = await _dio.get('/arrivals/$stopId', queryParameters: params);
    final list = (res.data['arrivals'] ?? res.data) as List;
    return list.map((e) => Arrival.fromJson(e as Map<String, dynamic>)).toList();
  }
}

final arrivalsApiProvider = Provider<ArrivalsApi>(
  (ref) => ArrivalsApi(ref.watch(dioProvider)),
);
