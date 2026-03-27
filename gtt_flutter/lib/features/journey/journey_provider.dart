import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/journey_api.dart';
import '../../../core/models/itinerary.dart';
import '../../../core/models/stop.dart';

class JourneyPlanState {
  final JourneyEndpoint? from;
  final JourneyEndpoint? to;
  final List<Itinerary> results;
  final bool loading;
  final String? error;

  const JourneyPlanState({
    this.from,
    this.to,
    this.results = const [],
    this.loading = false,
    this.error,
  });

  JourneyPlanState copyWith({
    JourneyEndpoint? from,
    JourneyEndpoint? to,
    List<Itinerary>? results,
    bool? loading,
    String? error,
  }) =>
      JourneyPlanState(
        from: from ?? this.from,
        to: to ?? this.to,
        results: results ?? this.results,
        loading: loading ?? this.loading,
        error: error,
      );

  bool get canSearch => from != null && to != null;
}

class JourneyPlanNotifier extends AutoDisposeAsyncNotifier<JourneyPlanState> {
  @override
  Future<JourneyPlanState> build() async => const JourneyPlanState();

  void setFrom(JourneyEndpoint? from) {
    state = AsyncData(
        (state.valueOrNull ?? const JourneyPlanState()).copyWith(from: from));
  }

  void setTo(JourneyEndpoint? to) {
    state = AsyncData(
        (state.valueOrNull ?? const JourneyPlanState()).copyWith(to: to));
  }

  void swap() {
    final s = state.valueOrNull ?? const JourneyPlanState();
    state = AsyncData(s.copyWith(from: s.to, to: s.from, results: []));
  }

  Future<void> search({String? departAt, String? arriveBy}) async {
    final s = state.valueOrNull ?? const JourneyPlanState();
    if (!s.canSearch) return;

    state = AsyncData(s.copyWith(loading: true, error: null));
    try {
      final results = await ref.read(journeyApiProvider).search(
            s.from!,
            s.to!,
            departAt: departAt,
            arriveBy: arriveBy,
          );
      state = AsyncData(s.copyWith(loading: false, results: results));
    } catch (e) {
      state = AsyncData(
          s.copyWith(loading: false, error: e.toString(), results: []));
    }
  }
}

final journeyPlanProvider =
    AsyncNotifierProvider.autoDispose<JourneyPlanNotifier, JourneyPlanState>(
  JourneyPlanNotifier.new,
);
