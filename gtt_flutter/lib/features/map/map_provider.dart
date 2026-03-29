import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/service_api.dart';
import '../../../core/api/stops_api.dart';
import '../../../core/models/stop.dart';
import '../../../core/models/vehicle.dart';
import '../../../core/services/mqtt_service.dart';

class MapViewState {
  final List<Vehicle> vehicles;
  final bool loading;
  final String? error;
  final String routeFilter;
  final int? typeFilter; // null=tutte, 0=tram, 1=metro, 3=bus
  final Vehicle? selected;
  final bool followSelected;
  final List<Stop> searchResults;
  final Stop? highlightedStop;

  const MapViewState({
    this.vehicles = const [],
    this.loading = true,
    this.error,
    this.routeFilter = '',
    this.typeFilter,
    this.selected,
    this.followSelected = false,
    this.searchResults = const [],
    this.highlightedStop,
  });

  List<Vehicle> get filteredVehicles {
    var list = vehicles;
    if (typeFilter != null) {
      list = list.where((v) => v.routeType == typeFilter).toList();
    }
    if (routeFilter.isNotEmpty) {
      list = list
          .where((v) => (v.routeShortName ?? '').toLowerCase() == routeFilter)
          .toList();
    }
    return list;
  }

  MapViewState copyWith({
    List<Vehicle>? vehicles,
    bool? loading,
    String? error,
    String? routeFilter,
    int? typeFilter,
    Vehicle? selected,
    bool? followSelected,
    List<Stop>? searchResults,
    Stop? highlightedStop,
    bool clearSelected = false,
    bool clearError = false,
    bool clearHighlightedStop = false,
    bool clearTypeFilter = false,
  }) =>
      MapViewState(
        vehicles: vehicles ?? this.vehicles,
        loading: loading ?? this.loading,
        error: clearError ? null : (error ?? this.error),
        routeFilter: routeFilter ?? this.routeFilter,
        typeFilter: clearTypeFilter ? null : (typeFilter ?? this.typeFilter),
        selected: clearSelected ? null : (selected ?? this.selected),
        followSelected: followSelected ?? this.followSelected,
        searchResults: searchResults ?? this.searchResults,
        highlightedStop: clearHighlightedStop
            ? null
            : (highlightedStop ?? this.highlightedStop),
      );
}

class MapLiveController extends StateNotifier<MapViewState> {
  final ServiceApi _serviceApi;
  final StopsApi _stopsApi;
  final MqttService _mqttService;
  Timer? _pollTimer;
  StreamSubscription<Vehicle>? _mqttSub;

  MapLiveController(this._serviceApi, this._stopsApi, this._mqttService)
      : super(const MapViewState()) {
    _init();
  }

  Future<void> _init() async {
    await _fetchVehicles();
    _pollTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => _fetchVehicles(),
    );

    await _mqttService.connect();
    _mqttSub = _mqttService.vehicleStream.listen(_mergeVehicleFromMqtt);
  }

  Future<void> _fetchVehicles() async {
    try {
      final vehicles = await _serviceApi.getVehicles();
      final selected = state.selected;
      Vehicle? selectedFresh;
      if (selected != null) {
        for (final v in vehicles) {
          if (v.vehicleId == selected.vehicleId) {
            selectedFresh = v;
            break;
          }
        }
        selectedFresh ??= selected;
      }
      state = state.copyWith(
        vehicles: vehicles,
        selected: selectedFresh,
        loading: false,
        clearError: true,
      );
    } catch (e) {
      state = state.copyWith(
        loading: false,
        error: e.toString(),
      );
    }
  }

  void _mergeVehicleFromMqtt(Vehicle vehicle) {
    final byId = <String, Vehicle>{
      for (final v in state.vehicles) v.vehicleId: v,
    };
    byId[vehicle.vehicleId] = vehicle;
    final merged = byId.values.toList();
    final selected = state.selected;
    state = state.copyWith(
      vehicles: merged,
      selected: selected == null ? null : byId[selected.vehicleId],
    );
  }

  Future<void> refresh() => _fetchVehicles();

  void selectVehicle(Vehicle? v) {
    state = state.copyWith(
      selected: v,
      clearSelected: v == null,
      followSelected: v == null ? false : state.followSelected,
    );
  }

  void toggleFollow() {
    if (state.selected == null) return;
    state = state.copyWith(followSelected: !state.followSelected);
  }

  void enableFollow() {
    if (state.selected == null) return;
    state = state.copyWith(followSelected: true);
  }

  void setRouteFilter(String filter) {
    state = state.copyWith(routeFilter: filter.toLowerCase());
  }

  void setTypeFilter(int? type) {
    state = state.copyWith(
      typeFilter: type,
      clearTypeFilter: type == null,
      routeFilter: '',
    );
  }

  Future<void> searchStops(String query) async {
    if (query.trim().length < 2) {
      state = state.copyWith(searchResults: const []);
      return;
    }
    try {
      final list = await _stopsApi.search(query.trim());
      state = state.copyWith(searchResults: list.take(8).toList());
    } catch (_) {
      state = state.copyWith(searchResults: const []);
    }
  }

  void selectStop(Stop stop) {
    state = state.copyWith(
      highlightedStop: stop,
      searchResults: const [],
    );
  }

  void clearHighlightedStop() {
    state = state.copyWith(clearHighlightedStop: true);
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _mqttSub?.cancel();
    super.dispose();
  }
}

final mapControllerProvider =
    StateNotifierProvider.autoDispose<MapLiveController, MapViewState>((ref) {
  return MapLiveController(
    ref.watch(serviceApiProvider),
    ref.watch(stopsApiProvider),
    ref.watch(mqttServiceProvider),
  );
});
