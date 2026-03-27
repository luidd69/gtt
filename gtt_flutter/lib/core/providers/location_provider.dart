import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

class LocationState {
  final double? lat;
  final double? lon;
  final bool loading;
  final String? error;

  const LocationState({this.lat, this.lon, this.loading = false, this.error});

  bool get hasLocation => lat != null && lon != null;
}

class LocationNotifier extends AsyncNotifier<LocationState> {
  @override
  Future<LocationState> build() async => const LocationState();

  Future<void> fetch() async {
    state = const AsyncData(LocationState(loading: true));
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        state = const AsyncData(LocationState(error: 'Servizio posizione disabilitato'));
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          state = const AsyncData(LocationState(error: 'Permesso posizione negato'));
          return;
        }
      }
      if (permission == LocationPermission.deniedForever) {
        state = const AsyncData(LocationState(
          error: 'Permesso posizione negato permanentemente — apri le impostazioni',
        ));
        return;
      }

      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 8),
      );

      state = AsyncData(LocationState(lat: pos.latitude, lon: pos.longitude));
    } catch (e) {
      state = AsyncData(LocationState(error: e.toString()));
    }
  }
}

final locationProvider =
    AsyncNotifierProvider<LocationNotifier, LocationState>(
  LocationNotifier.new,
);
