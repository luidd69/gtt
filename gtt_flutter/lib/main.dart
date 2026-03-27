import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/router/app_router.dart';
import 'core/services/notification_service.dart';
import 'core/theme/app_theme.dart';
import 'core/providers/theme_provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase: comentare se non si usa FCM
  try {
    await Firebase.initializeApp();
  } catch (_) {
    // Firebase non configurato: le notifiche locali funzioneranno comunque
  }

  runApp(
    const ProviderScope(
      child: GttApp(),
    ),
  );
}

class GttApp extends ConsumerWidget {
  const GttApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final themeAsync = ref.watch(themeProvider);
    final themeMode = themeAsync.valueOrNull ?? ThemeMode.system;

    // Inizializza notifiche all'avvio
    ref.watch(notificationServiceProvider); // forza creazione

    return MaterialApp.router(
      title: 'GTT Torino',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: themeMode,
      routerConfig: router,
    );
  }
}
