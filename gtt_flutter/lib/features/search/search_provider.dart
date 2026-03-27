import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/stops_api.dart';
import '../../../core/models/stop.dart';

class SearchState {
  final String query;
  final List<Stop> results;
  final bool loading;
  final String? error;

  const SearchState({
    this.query = '',
    this.results = const [],
    this.loading = false,
    this.error,
  });

  SearchState copyWith({
    String? query,
    List<Stop>? results,
    bool? loading,
    String? error,
  }) =>
      SearchState(
        query: query ?? this.query,
        results: results ?? this.results,
        loading: loading ?? this.loading,
        error: error,
      );
}

class SearchNotifier extends AutoDisposeAsyncNotifier<SearchState> {
  Timer? _debounce;

  @override
  Future<SearchState> build() async {
    ref.onDispose(() => _debounce?.cancel());
    return const SearchState();
  }

  void onQueryChanged(String query) {
    _debounce?.cancel();
    if (query.isEmpty) {
      state = const AsyncData(SearchState());
      return;
    }
    state = AsyncData(
        (state.valueOrNull ?? const SearchState()).copyWith(query: query, loading: true));
    _debounce = Timer(const Duration(milliseconds: 300), () => _search(query));
  }

  Future<void> _search(String query) async {
    if (query.length < 2) return;
    try {
      final results = await ref.read(stopsApiProvider).search(query);
      state = AsyncData(SearchState(query: query, results: results));
    } catch (e) {
      state = AsyncData(SearchState(query: query, error: e.toString()));
    }
  }

}

final searchProvider =
    AsyncNotifierProvider.autoDispose<SearchNotifier, SearchState>(
  SearchNotifier.new,
);

final nearbyStopsSearchProvider = FutureProvider.autoDispose.family<List<Stop>, (double, double)>(
  (ref, coords) => ref.watch(stopsApiProvider).nearby(coords.$1, coords.$2),
);
