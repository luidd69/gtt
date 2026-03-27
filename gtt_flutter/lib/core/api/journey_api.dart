import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/itinerary.dart';
import 'api_client.dart';

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

  Future<List<Itinerary>> search(
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

    final res = await _dio.get('/journey/search', queryParameters: params);
    final data = res.data;
    // backend ritorna { journeys: [...] } oppure { itineraries: [...] }
    final raw = data['journeys'] ?? data['itineraries'] ?? data;
    final list = raw as List;
    return list
        .map((e) => Itinerary.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

final journeyApiProvider = Provider<JourneyApi>(
  (ref) => JourneyApi(ref.watch(dioProvider)),
);
