import 'dart:async';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;

class NotificationService {
  static final _localNotifications = FlutterLocalNotificationsPlugin();
  Future<void>? _initFuture;

  // Timer Dart per notifiche schedulate (path primario, funziona su MIUI)
  final Map<int, Timer> _pendingTimers = {};

  static const _channelId = 'gtt_reminders';
  static const _channelName = 'Promemoria GTT';
  static const _channelDesc = 'Notifiche per i promemoria di partenza';

  Future<void> initialize() {
    _initFuture ??= _initializeInternal();
    return _initFuture!;
  }

  Future<void> _initializeInternal() async {
    tz.initializeTimeZones();
    tz.setLocalLocation(tz.getLocation('Europe/Rome'));

    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidSettings);

    await _localNotifications.initialize(initSettings);

    // Canale Android (API 26+)
    const androidChannel = AndroidNotificationChannel(
      _channelId,
      _channelName,
      description: _channelDesc,
      importance: Importance.high,
    );
    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(androidChannel);

    // Firebase: opzionale, non blocca le notifiche locali se non disponibile.
    try {
      await FirebaseMessaging.instance.requestPermission();
      FirebaseMessaging.onMessage.listen((message) async {
        final notification = message.notification;
        final title =
            notification?.title ?? message.data['title'] ?? 'GTT Torino';
        final body = notification?.body ?? message.data['body'] ?? '';
        await showLocalNotification(
          id: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          title: title,
          body: body,
          tag: message.data['tag'],
        );
      });
    } catch (_) {
      // Firebase non disponibile: le notifiche locali funzionano comunque.
    }
  }

  Future<String?> getFcmToken() async {
    await initialize();
    return FirebaseMessaging.instance.getToken();
  }

  Future<void> showLocalNotification({
    required int id,
    required String title,
    required String body,
    String? tag,
  }) async {
    await initialize();
    await _localNotifications.show(
      id,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          channelDescription: _channelDesc,
          importance: Importance.high,
          priority: Priority.high,
          tag: tag,
        ),
      ),
    );
  }

  /// Schedula una notifica locale persistente (sopravvive al kill dell'app).
  Future<void> scheduleLocalNotification({
    required int id,
    required String title,
    required String body,
    required DateTime fireAt,
    String? tag,
  }) async {
    await initialize();

    final delay = fireAt.difference(DateTime.now());
    if (delay.isNegative) return;

    // ── Path 1: Timer Dart (funziona su MIUI quando l'app è attiva) ──
    _pendingTimers[id]?.cancel();
    _pendingTimers[id] = Timer(delay, () async {
      _pendingTimers.remove(id);
      await showLocalNotification(id: id, title: title, body: body, tag: tag);
    });

    // ── Path 2: zonedSchedule come salva-schermo se l'app viene killata ──
    try {
      final tzFireAt = tz.TZDateTime.from(fireAt, tz.local);
      await _localNotifications.zonedSchedule(
        id,
        title,
        body,
        tzFireAt,
        NotificationDetails(
          android: AndroidNotificationDetails(
            _channelId,
            _channelName,
            channelDescription: _channelDesc,
            importance: Importance.high,
            priority: Priority.high,
            tag: tag,
          ),
        ),
        androidScheduleMode: AndroidScheduleMode.alarmClock,
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
      );
    } catch (_) {
      // Su MIUI zonedSchedule può fallire — il Timer sopra gestisce il caso.
    }
  }

  Future<void> cancelNotification(int id) async {
    // Cancella anche il timer Dart se presente
    _pendingTimers.remove(id)?.cancel();
    await initialize();
    await _localNotifications.cancel(id);
  }

  void dispose() {
    for (final t in _pendingTimers.values) {
      t.cancel();
    }
    _pendingTimers.clear();
  }
}

final notificationServiceProvider = Provider<NotificationService>((ref) {
  final service = NotificationService();
  // Avvio best-effort: non blocca il rendering dell'app.
  service.initialize();
  return service;
});
