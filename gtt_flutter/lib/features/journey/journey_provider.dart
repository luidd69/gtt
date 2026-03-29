import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/journey_api.dart';
import '../../../core/models/itinerary.dart';

class JourneyPlanState {
  final JourneyEndpoint? from;
  final JourneyEndpoint? to;
  final List<Itinerary> results;
  final bool loading;
  final String? error;
  final bool arriveByMode;
  final String? arriveByTime; // HH:MM
  final Map<String, int>? solutions;
  final String? source;
  final bool fallback;
  final String? generatedAt;

  const JourneyPlanState({
    this.from,
    this.to,
    this.results = const [],
    this.loading = false,
    this.error,
    this.arriveByMode = false,
    this.arriveByTime,
    this.solutions,
    this.source,
    this.fallback = false,
    this.generatedAt,
  });

  JourneyPlanState copyWith({
    JourneyEndpoint? from,
    JourneyEndpoint? to,
    List<Itinerary>? results,
    bool? loading,
    String? error,
    bool? arriveByMode,
    String? arriveByTime,
    Map<String, int>? solutions,
    String? source,
    bool? fallback,
    String? generatedAt,
    bool clearError = false,
  }) =>
      JourneyPlanState(
        from: from ?? this.from,
        to: to ?? this.to,
        results: results ?? this.results,
        loading: loading ?? this.loading,
        error: clearError ? null : (error ?? this.error),
        arriveByMode: arriveByMode ?? this.arriveByMode,
        arriveByTime: arriveByTime ?? this.arriveByTime,
        solutions: solutions ?? this.solutions,
        source: source ?? this.source,
        fallback: fallback ?? this.fallback,
        generatedAt: generatedAt ?? this.generatedAt,
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

  void setArriveByMode(bool value) {
    final s = state.valueOrNull ?? const JourneyPlanState();
    state = AsyncData(s.copyWith(arriveByMode: value));
  }

  void setArriveByTime(String? time) {
    final s = state.valueOrNull ?? const JourneyPlanState();
    state = AsyncData(s.copyWith(arriveByTime: time));
  }

  Future<void> search() async {
    final s = state.valueOrNull ?? const JourneyPlanState();
    if (!s.canSearch) return;

    state = AsyncData(s.copyWith(loading: true, clearError: true));
    try {
      final arriveBy = s.arriveByMode ? s.arriveByTime : null;
      final result = await ref.read(journeyApiProvider).search(
            s.from!,
            s.to!,
            arriveBy: arriveBy,
          );
      state = AsyncData(s.copyWith(
        loading: false,
        results: result.itineraries,
        solutions: result.solutions,
        source: result.source,
        fallback: result.fallback,
        generatedAt: result.generatedAt,
      ));
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
