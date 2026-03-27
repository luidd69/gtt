import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/stop.dart';

const _kFavoritesKey = 'gtt_favorites';
const _kRecentKey = 'gtt_recent_stops';

class FavoritesState {
  final List<Stop> favorites;
  final List<Stop> recentStops;

  const FavoritesState({
    required this.favorites,
    required this.recentStops,
  });

  FavoritesState copyWith({List<Stop>? favorites, List<Stop>? recentStops}) =>
      FavoritesState(
        favorites: favorites ?? this.favorites,
        recentStops: recentStops ?? this.recentStops,
      );
}

class FavoritesNotifier extends AsyncNotifier<FavoritesState> {
  @override
  Future<FavoritesState> build() async {
    final prefs = await SharedPreferences.getInstance();
    final favJson = prefs.getStringList(_kFavoritesKey) ?? [];
    final recentJson = prefs.getStringList(_kRecentKey) ?? [];
    return FavoritesState(
      favorites: favJson
          .map((s) => Stop.fromJson(jsonDecode(s) as Map<String, dynamic>))
          .toList(),
      recentStops: recentJson
          .map((s) => Stop.fromJson(jsonDecode(s) as Map<String, dynamic>))
          .toList(),
    );
  }

  bool isFavorite(String stopId) {
    final s = state.valueOrNull;
    return s?.favorites.any((f) => f.stopId == stopId) ?? false;
  }

  Future<void> toggle(Stop stop) async {
    final current = state.valueOrNull ?? const FavoritesState(favorites: [], recentStops: []);
    List<Stop> updated;
    if (isFavorite(stop.stopId)) {
      updated = current.favorites.where((f) => f.stopId != stop.stopId).toList();
    } else {
      updated = [...current.favorites, stop];
    }
    state = AsyncData(current.copyWith(favorites: updated));
    await _persist(updated, _kFavoritesKey);
  }

  Future<void> addRecent(Stop stop) async {
    final current = state.valueOrNull ?? const FavoritesState(favorites: [], recentStops: []);
    final without = current.recentStops.where((s) => s.stopId != stop.stopId).toList();
    final updated = [stop, ...without].take(10).toList();
    state = AsyncData(current.copyWith(recentStops: updated));
    await _persist(updated, _kRecentKey);
  }

  Future<void> _persist(List<Stop> stops, String key) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(
      key,
      stops.map((s) => jsonEncode(s.toJson())).toList(),
    );
  }
}

final favoritesProvider =
    AsyncNotifierProvider<FavoritesNotifier, FavoritesState>(
  FavoritesNotifier.new,
);
