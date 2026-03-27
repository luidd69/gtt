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
        builder: (_, state) =>
            StopDetailScreen(stopId: state.pathParameters['stopId']!),
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
        builder: (_, __) => const VehicleMapScreen(),
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
    errorBuilder: (_, state) => Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.red),
            const SizedBox(height: 12),
            Text('Pagina non trovata: ${state.uri}'),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => GoRouter.of(state.extra as BuildContext).go('/home'),
              child: const Text('Torna alla home'),
            ),
          ],
        ),
      ),
    ),
  );
});
