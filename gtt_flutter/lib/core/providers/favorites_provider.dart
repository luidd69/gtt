import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/stop.dart';
import '../models/route_line.dart';

const _kFavoritesKey = 'gtt_favorites';
const _kRecentKey = 'gtt_recent_stops';
const _kFavLinesKey = 'gtt_fav_lines';
const _kFrequentRoutesKey = 'gtt_frequent_routes';

class FrequentRoute {
  final String fromId;
  final String fromName;
  final String toId;
  final String toName;
  final int usageCount;
  final int lastUsed;

  const FrequentRoute({
    required this.fromId,
    required this.fromName,
    required this.toId,
    required this.toName,
    this.usageCount = 1,
    required this.lastUsed,
  });

  FrequentRoute copyWith({int? usageCount, int? lastUsed}) => FrequentRoute(
        fromId: fromId,
        fromName: fromName,
        toId: toId,
        toName: toName,
        usageCount: usageCount ?? this.usageCount,
        lastUsed: lastUsed ?? this.lastUsed,
      );

  Map<String, dynamic> toJson() => {
        'fromId': fromId,
        'fromName': fromName,
        'toId': toId,
        'toName': toName,
        'usageCount': usageCount,
        'lastUsed': lastUsed,
      };

  factory FrequentRoute.fromJson(Map<String, dynamic> json) => FrequentRoute(
        fromId: json['fromId'] ?? '',
        fromName: json['fromName'] ?? '',
        toId: json['toId'] ?? '',
        toName: json['toName'] ?? '',
        usageCount: (json['usageCount'] ?? 1) as int,
        lastUsed: (json['lastUsed'] ??
            DateTime.now().millisecondsSinceEpoch) as int,
      );
}

class FavoritesState {
  final List<Stop> favorites;
  final List<Stop> recentStops;
  final List<RouteLine> favoriteLines;
  final List<FrequentRoute> frequentRoutes;

  const FavoritesState({
    required this.favorites,
    required this.recentStops,
    this.favoriteLines = const [],
    this.frequentRoutes = const [],
  });

  FavoritesState copyWith({
    List<Stop>? favorites,
    List<Stop>? recentStops,
    List<RouteLine>? favoriteLines,
    List<FrequentRoute>? frequentRoutes,
  }) =>
      FavoritesState(
        favorites: favorites ?? this.favorites,
        recentStops: recentStops ?? this.recentStops,
        favoriteLines: favoriteLines ?? this.favoriteLines,
        frequentRoutes: frequentRoutes ?? this.frequentRoutes,
      );
}

class FavoritesNotifier extends AsyncNotifier<FavoritesState> {
  @override
  Future<FavoritesState> build() async {
    final prefs = await SharedPreferences.getInstance();
    final favJson = prefs.getStringList(_kFavoritesKey) ?? [];
    final recentJson = prefs.getStringList(_kRecentKey) ?? [];
    final favLinesJson = prefs.getStringList(_kFavLinesKey) ?? [];
    final freqJson = prefs.getStringList(_kFrequentRoutesKey) ?? [];
    return FavoritesState(
      favorites: favJson
          .map((s) => Stop.fromJson(jsonDecode(s) as Map<String, dynamic>))
          .toList(),
      recentStops: recentJson
          .map((s) => Stop.fromJson(jsonDecode(s) as Map<String, dynamic>))
          .toList(),
      favoriteLines: favLinesJson
          .map((s) =>
              RouteLine.fromJson(jsonDecode(s) as Map<String, dynamic>))
          .toList(),
      frequentRoutes: freqJson
          .map((s) =>
              FrequentRoute.fromJson(jsonDecode(s) as Map<String, dynamic>))
          .toList(),
    );
  }

  bool isFavorite(String stopId) =>
      state.valueOrNull?.favorites.any((f) => f.stopId == stopId) ?? false;

  bool isLineFavorite(String routeId) =>
      state.valueOrNull?.favoriteLines.any((l) => l.routeId == routeId) ??
      false;

  Future<void> toggle(Stop stop) async {
    final current = state.valueOrNull ??
        const FavoritesState(favorites: [], recentStops: []);
    final updated = isFavorite(stop.stopId)
        ? current.favorites.where((f) => f.stopId != stop.stopId).toList()
        : [...current.favorites, stop];
    state = AsyncData(current.copyWith(favorites: updated));
    await _persistStops(updated, _kFavoritesKey);
  }

  Future<void> toggleLine(RouteLine line) async {
    final current = state.valueOrNull ??
        const FavoritesState(favorites: [], recentStops: []);
    final updated = isLineFavorite(line.routeId)
        ? current.favoriteLines
            .where((l) => l.routeId != line.routeId)
            .toList()
        : [...current.favoriteLines, line];
    state = AsyncData(current.copyWith(favoriteLines: updated));
    await _persistLines(updated);
  }

  Future<void> addRecent(Stop stop) async {
    final current = state.valueOrNull ??
        const FavoritesState(favorites: [], recentStops: []);
    final without =
        current.recentStops.where((s) => s.stopId != stop.stopId).toList();
    final updated = [stop, ...without].take(10).toList();
    state = AsyncData(current.copyWith(recentStops: updated));
    await _persistStops(updated, _kRecentKey);
  }

  Future<void> trackRoute({
    required String fromId,
    required String fromName,
    required String toId,
    required String toName,
  }) async {
    final current = state.valueOrNull ??
        const FavoritesState(favorites: [], recentStops: []);
    final now = DateTime.now().millisecondsSinceEpoch;
    final idx = current.frequentRoutes
        .indexWhere((r) => r.fromId == fromId && r.toId == toId);
    List<FrequentRoute> updated;
    if (idx >= 0) {
      final r = current.frequentRoutes[idx];
      updated = [...current.frequentRoutes];
      updated[idx] = r.copyWith(usageCount: r.usageCount + 1, lastUsed: now);
    } else {
      updated = [
        ...current.frequentRoutes,
        FrequentRoute(
            fromId: fromId,
            fromName: fromName,
            toId: toId,
            toName: toName,
            lastUsed: now),
      ];
    }
    updated.sort((a, b) => b.usageCount.compareTo(a.usageCount));
    if (updated.length > 10) updated = updated.take(10).toList();
    state = AsyncData(current.copyWith(frequentRoutes: updated));
    await _persistFrequentRoutes(updated);
  }

  Future<void> _persistStops(List<Stop> stops, String key) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(
        key, stops.map((s) => jsonEncode(s.toJson())).toList());
  }

  Future<void> _persistLines(List<RouteLine> lines) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(
        _kFavLinesKey, lines.map((l) => jsonEncode(l.toJson())).toList());
  }

  Future<void> _persistFrequentRoutes(List<FrequentRoute> routes) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_kFrequentRoutesKey,
        routes.map((r) => jsonEncode(r.toJson())).toList());
  }
}

final favoritesProvider =
    AsyncNotifierProvider<FavoritesNotifier, FavoritesState>(
  FavoritesNotifier.new,
);
