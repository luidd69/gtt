import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/arrivals_api.dart';
import '../../../core/api/stops_api.dart';
import '../../../core/models/arrival.dart';
import '../../../core/models/stop.dart';

final stopDetailProvider = FutureProvider.autoDispose.family<Stop, String>(
  (ref, stopId) => ref.watch(stopsApiProvider).getById(stopId),
);

// Stream che si auto-aggiorna ogni 30 sec
final arrivalsStreamProvider =
    StreamProvider.autoDispose.family<List<Arrival>, String>((ref, stopId) {
  return Stream.periodic(const Duration(seconds: 30), (_) => 0)
      .asyncMap((_) => ref.read(arrivalsApiProvider).getArrivals(stopId))
      .startWith(ref.read(arrivalsApiProvider).getArrivals(stopId));
});

// Extension per Stream.startWith
extension StartWith<T> on Stream<T> {
  Stream<T> startWith(Future<T> first) async* {
    yield await first;
    yield* this;
  }
}

final arrivalsCustomTimeProvider = FutureProvider.autoDispose
    .family<List<Arrival>, ({String stopId, String date, String time})>(
  (ref, args) => ref
      .watch(arrivalsApiProvider)
      .getArrivals(args.stopId, date: args.date, time: args.time),
);
