import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/itinerary.dart';
import 'api_client.dart';

class JourneyResult {
  final List<Itinerary> itineraries;
  final Map<String, int>? solutions; // { soonest: 0, fastest: 2, reliable: 1 }
  final String? source; // 'otp' | 'gtfs'
  final bool fallback;
  final String? generatedAt;

  const JourneyResult({
    required this.itineraries,
    this.solutions,
    this.source,
    this.fallback = false,
    this.generatedAt,
  });
}

class JourneyEndpoint {
  final String? stopId;
  final String? stopName;
  final double? lat;
  final double? lon;
  final bool isMyLocation;

  const JourneyEndpoint({
    this.stopId,
    this.stopName,
    this.lat,
    this.lon,
    this.isMyLocation = false,
  });
}

class JourneyApi {
  final Dio _dio;
  const JourneyApi(this._dio);

  Future<JourneyResult> search(
    JourneyEndpoint from,
    JourneyEndpoint to, {
    int lookahead = 120,
    String? arriveBy,
    String? departAt,
  }) async {
    final params = <String, dynamic>{'lookahead': lookahead};

    if (from.stopId != null) {
      params['from'] = from.stopId;
    } else if (from.lat != null) {
      params['fromLat'] = from.lat;
      params['fromLon'] = from.lon;
    }

    if (to.stopId != null) {
      params['to'] = to.stopId;
    } else if (to.lat != null) {
      params['toLat'] = to.lat;
      params['toLon'] = to.lon;
    }

    if (arriveBy != null) params['arriveBy'] = arriveBy;
    if (departAt != null) params['departAt'] = departAt;

    final res = await _dio.get('/journey/plan', queryParameters: params);
    final data = res.data;
    // backend ritorna { journeys: [...] } oppure { itineraries: [...] }
    final raw = data['itineraries'] ?? data['journeys'] ?? data;
    final list = raw as List;
    return JourneyResult(
      itineraries: list
          .map((e) => Itinerary.fromJson(e as Map<String, dynamic>))
          .toList(),
      solutions: (data['solutions'] as Map?)?.cast<String, int>(),
      source: data['source']?.toString(),
      fallback: data['fallback'] == true,
      generatedAt: data['generatedAt']?.toString(),
    );
  }

  Future<Map<String, dynamic>> searchMetro(
    String fromStop,
    String toStop, {
    int lookahead = 90,
  }) async {
    final res = await _dio.get(
      '/journey/metro',
      queryParameters: {
        'from': fromStop,
        'to': toStop,
        'lookahead': lookahead,
      },
    );
    return (res.data as Map).cast<String, dynamic>();
  }
}

final journeyApiProvider = Provider<JourneyApi>(
  (ref) => JourneyApi(ref.watch(dioProvider)),
);
