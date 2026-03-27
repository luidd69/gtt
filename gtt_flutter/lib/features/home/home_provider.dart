import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/service_api.dart';
import '../../../core/api/stops_api.dart';
import '../../../core/providers/favorites_provider.dart';
import '../../../core/providers/location_provider.dart';
import '../../../core/models/stop.dart';

final serviceStatusHomeProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(serviceApiProvider).getStatus(),
);

final nearbyStopsHomeProvider = FutureProvider.autoDispose<List<Stop>>((ref) async {
  final loc = ref.watch(locationProvider).valueOrNull;
  if (loc == null || !loc.hasLocation) return [];
  return ref.watch(stopsApiProvider).nearby(loc.lat!, loc.lon!);
});
