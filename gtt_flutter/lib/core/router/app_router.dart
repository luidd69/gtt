import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/home/home_screen.dart';
import '../../features/search/search_screen.dart';
import '../../features/stop_detail/stop_detail_screen.dart';
import '../../features/journey/journey_planner_screen.dart';
import '../../features/journey/itinerary_detail_screen.dart';
import '../../features/map/vehicle_map_screen.dart';
import '../../features/reminders/reminders_screen.dart';
import '../../features/info/info_screen.dart';
import '../../features/trip_detail/trip_detail_screen.dart';
import '../../features/nearby/nearby_screen.dart';
import '../../features/favorites/favorites_screen.dart';
import '../../features/lines/lines_screen.dart';
import '../../features/lines/line_detail_screen.dart';
import '../../features/metro/metro_screen.dart';
import '../../core/models/itinerary.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/home',
    debugLogDiagnostics: true,
    routes: [
      GoRoute(
        path: '/home',
        builder: (_, __) => const HomeScreen(),
      ),
      GoRoute(
        path: '/search',
        builder: (_, __) => const SearchScreen(),
      ),
      GoRoute(
        path: '/stops/:stopId',
        builder: (_, state) => StopDetailScreen(
          stopId: Uri.decodeComponent(state.pathParameters['stopId']!),
        ),
      ),
      GoRoute(
        path: '/journey',
        builder: (_, __) => const JourneyPlannerScreen(),
        routes: [
          GoRoute(
            path: 'itinerary',
            builder: (_, state) => ItineraryDetailScreen(
              itinerary: state.extra as Itinerary,
            ),
          ),
        ],
      ),
      GoRoute(
        path: '/map',
        builder: (_, state) {
          final typeFilterStr = state.uri.queryParameters['typeFilter'];
          final typeFilter =
              typeFilterStr != null ? int.tryParse(typeFilterStr) : null;
          return VehicleMapScreen(
            initialTripId: state.uri.queryParameters['tripId'] != null
                ? Uri.decodeQueryComponent(
                    state.uri.queryParameters['tripId']!)
                : null,
            initialTypeFilter: typeFilter,
          );
        },
      ),
      GoRoute(
        path: '/trips/:tripId',
        builder: (_, state) => TripDetailScreen(
          tripId: Uri.decodeComponent(state.pathParameters['tripId']!),
          fromStop: state.uri.queryParameters['fromStop'] != null
              ? Uri.decodeQueryComponent(state.uri.queryParameters['fromStop']!)
              : null,
          toStop: state.uri.queryParameters['toStop'] != null
              ? Uri.decodeQueryComponent(state.uri.queryParameters['toStop']!)
              : null,
        ),
      ),
      GoRoute(
        path: '/settings',
        builder: (_, __) => const InfoScreen(),
      ),
      GoRoute(
        path: '/nearby',
        builder: (_, __) => const NearbyScreen(),
      ),
      GoRoute(
        path: '/favorites',
        builder: (_, __) => const FavoritesScreen(),
      ),
      GoRoute(
        path: '/lines',
        builder: (_, __) => const LinesScreen(),
      ),
      GoRoute(
        path: '/lines/:routeId',
        builder: (_, state) => LineDetailScreen(
          routeId: Uri.decodeComponent(state.pathParameters['routeId']!),
        ),
      ),
      GoRoute(
        path: '/metro',
        builder: (_, __) => const MetroScreen(),
      ),
      GoRoute(
        path: '/reminders',
        builder: (_, __) => const RemindersScreen(),
      ),
      GoRoute(
        path: '/info',
        builder: (_, __) => const InfoScreen(),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.red),
            const SizedBox(height: 12),
            Text('Pagina non trovata: ${state.uri}'),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => context.go('/home'),
              child: const Text('Torna alla home'),
            ),
          ],
        ),
      ),
    ),
  );
});
