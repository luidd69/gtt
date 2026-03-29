import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';

class TripsApi {
  final Dio _dio;
  const TripsApi(this._dio);

  List<String> _tripCandidates(String tripId) {
    final base =
        tripId.endsWith('U') ? tripId.substring(0, tripId.length - 1) : tripId;
    final out = <String>[tripId];
    if (RegExp(r'^\d+$').hasMatch(base) && !out.contains('${base}U')) {
      out.add('${base}U');
    }
    if (tripId.endsWith('U') && base.isNotEmpty && !out.contains(base)) {
      out.add(base);
    }
    return out;
  }

  bool _is404(DioException e) => e.response?.statusCode == 404;

  Future<Map<String, dynamic>> getTripLive(String tripId) async {
    final ids = _tripCandidates(tripId);
    DioException? last404;

    for (final id in ids) {
      try {
        final encodedId = Uri.encodeComponent(id);
        final res = await _dio.get('/trips/$encodedId/live');
        return res.data as Map<String, dynamic>;
      } on DioException catch (e) {
        if (_is404(e)) {
          last404 = e;
          continue;
        }
        rethrow;
      }
    }

    if (last404 != null) throw last404;
    throw StateError('Trip live non disponibile');
  }

  Future<Map<String, dynamic>> getTripDetail(
    String tripId, {
    String? fromStop,
    String? toStop,
  }) async {
    final params = <String, dynamic>{};
    if (fromStop != null) params['fromStop'] = fromStop;
    if (toStop != null) params['toStop'] = toStop;

    final ids = _tripCandidates(tripId);
    DioException? last404;

    for (final id in ids) {
      try {
        final encodedId = Uri.encodeComponent(id);
        final res =
            await _dio.get('/journey/trip/$encodedId', queryParameters: params);
        return res.data as Map<String, dynamic>;
      } on DioException catch (e) {
        if (_is404(e)) {
          last404 = e;
          continue;
        }
        rethrow;
      }
    }

    if (last404 != null) throw last404;
    throw StateError('Trip detail non disponibile');
  }
}

final tripsApiProvider = Provider<TripsApi>(
  (ref) => TripsApi(ref.watch(dioProvider)),
);
