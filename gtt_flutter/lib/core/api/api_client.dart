import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// Configura qui l'IP del server backend GTT
// In emulatore Android: 10.0.2.2 punta a localhost dell'host
const String kBaseUrl = String.fromEnvironment(
  'GTT_API_URL',
  defaultValue: 'http://10.0.2.2:3011/api',
);

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: kBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Accept': 'application/json'},
    ),
  );
  dio.interceptors.add(
    LogInterceptor(
      requestBody: false,
      responseBody: false,
      logPrint: (msg) => debugPrint('[GTT API] $msg'),
    ),
  );
  return dio;
});

void debugPrint(String message) {
  assert(() {
    // ignore: avoid_print
    print(message);
    return true;
  }());
}
