import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/service_api.dart';
import '../../../core/models/vehicle.dart';
import '../../../core/services/mqtt_service.dart';

final vehiclesPollingProvider =
    StreamProvider.autoDispose<List<Vehicle>>((ref) {
  return Stream.periodic(const Duration(seconds: 5), (_) => 0)
      .asyncMap((_) => ref.read(serviceApiProvider).getVehicles());
});
