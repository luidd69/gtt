import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../../core/models/vehicle.dart';
import '../../core/providers/location_provider.dart';
import '../../core/theme/colors.dart';
import '../../widgets/bottom_nav.dart';
import '../../widgets/route_chip.dart';
import 'map_provider.dart';

const _torinoCenter = LatLng(45.0703, 7.6869);

class VehicleMapScreen extends ConsumerStatefulWidget {
  const VehicleMapScreen({super.key});

  @override
  ConsumerState<VehicleMapScreen> createState() => _VehicleMapScreenState();
}

class _VehicleMapScreenState extends ConsumerState<VehicleMapScreen> {
  final _mapCtrl = MapController();
  Vehicle? _selected;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(locationProvider.notifier).fetch();
    });
  }

  @override
  Widget build(BuildContext context) {
    final vehiclesAsync = ref.watch(vehiclesPollingProvider);
    final locState = ref.watch(locationProvider).valueOrNull;

    return Scaffold(
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapCtrl,
            options: MapOptions(
              initialCenter: locState?.hasLocation == true
                  ? LatLng(locState!.lat!, locState.lon!)
                  : _torinoCenter,
              initialZoom: 13.5,
              onTap: (_, __) => setState(() => _selected = null),
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'it.gtt.gtt_flutter',
              ),
              vehiclesAsync.when(
                data: (vehicles) => MarkerLayer(
                  markers: vehicles.map((v) => _vehicleMarker(v)).toList(),
                ),
                loading: () => const MarkerLayer(markers: []),
                error: (_, __) => const MarkerLayer(markers: []),
              ),
              if (locState?.hasLocation == true)
                MarkerLayer(markers: [
                  Marker(
                    point: LatLng(locState!.lat!, locState.lon!),
                    width: 20,
                    height: 20,
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.brand,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 3),
                        boxShadow: [
                          BoxShadow(color: AppColors.brand.withAlpha(80), blurRadius: 8)
                        ],
                      ),
                    ),
                  )
                ]),
            ],
          ),
          // AppBar overlay
          Positioned(
            top: MediaQuery.of(context).padding.top,
            left: 0,
            right: 0,
            child: Container(
              color: Theme.of(context).scaffoldBackgroundColor.withAlpha(230),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back),
                    onPressed: () => context.go('/home'),
                  ),
                  const Text('Mappa veicoli',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  const Spacer(),
                  vehiclesAsync.when(
                    data: (v) => Text('${v.length} veicoli',
                        style: const TextStyle(color: AppColors.text3, fontSize: 12)),
                    loading: () => const SizedBox.shrink(),
                    error: (_, __) => const SizedBox.shrink(),
                  ),
                ],
              ),
            ),
          ),
          // Center-on-me FAB
          Positioned(
            bottom: 90,
            right: 16,
            child: FloatingActionButton.small(
              heroTag: 'center_me',
              onPressed: () {
                if (locState?.hasLocation == true) {
                  _mapCtrl.move(LatLng(locState!.lat!, locState.lon!), 15);
                } else {
                  ref.read(locationProvider.notifier).fetch();
                }
              },
              child: const Icon(Icons.my_location),
            ),
          ),
          // Selected vehicle popup
          if (_selected != null)
            Positioned(
              bottom: 80,
              left: 16,
              right: 16,
              child: _VehiclePopup(
                vehicle: _selected!,
                onClose: () => setState(() => _selected = null),
              ),
            ),
        ],
      ),
      bottomNavigationBar: const BottomNav(currentIndex: 3),
    );
  }

  Marker _vehicleMarker(Vehicle v) {
    return Marker(
      point: LatLng(v.lat, v.lon),
      width: 36,
      height: 36,
      child: GestureDetector(
        onTap: () => setState(() => _selected = v),
        child: _VehicleIcon(vehicle: v, selected: _selected?.vehicleId == v.vehicleId),
      ),
    );
  }
}

class _VehicleIcon extends StatelessWidget {
  final Vehicle vehicle;
  final bool selected;
  const _VehicleIcon({required this.vehicle, required this.selected});

  Color _parseColor(String? hex) {
    if (hex == null || hex.isEmpty) return AppColors.brand;
    try {
      return Color(int.parse('FF${hex.replaceFirst('#', '')}', radix: 16));
    } catch (_) {
      return AppColors.brand;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _parseColor(vehicle.routeColor);
    return Transform.rotate(
      angle: vehicle.bearing != null ? vehicle.bearing! * 3.14159 / 180 : 0,
      child: Container(
        width: selected ? 36 : 28,
        height: selected ? 36 : 28,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: selected ? 3 : 2),
          boxShadow: [
            BoxShadow(color: color.withAlpha(100), blurRadius: 6)
          ],
        ),
        alignment: Alignment.center,
        child: Text(
          vehicle.routeShortName?.substring(0, vehicle.routeShortName!.length.clamp(0, 3)) ?? '?',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 9,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}

class _VehiclePopup extends StatelessWidget {
  final Vehicle vehicle;
  final VoidCallback onClose;

  const _VehiclePopup({required this.vehicle, required this.onClose});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            if (vehicle.routeShortName != null)
              RouteChip(shortName: vehicle.routeShortName!, color: vehicle.routeColor),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (vehicle.headsign != null)
                    Text(vehicle.headsign!,
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                  if (vehicle.speed != null)
                    Text('${vehicle.speed} km/h',
                        style: const TextStyle(color: AppColors.text3, fontSize: 12)),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.close, size: 18, color: AppColors.text3),
              onPressed: onClose,
              visualDensity: VisualDensity.compact,
              padding: EdgeInsets.zero,
            ),
          ],
        ),
      ),
    );
  }
}
