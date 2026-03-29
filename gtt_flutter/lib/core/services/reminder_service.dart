import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/reminders_api.dart';
import '../models/reminder.dart';
import 'notification_service.dart';

const _kRemindersKey = 'gtt_reminders';

class ReminderService {
  final NotificationService _notifications;
  final RemindersApi _remindersApi;

  ReminderService(this._notifications, this._remindersApi);

  Future<List<Reminder>> loadAll() async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_kRemindersKey) ?? [];
    return list
        .map((s) => Reminder.fromJson(jsonDecode(s) as Map<String, dynamic>))
        .toList();
  }

  Future<Reminder> schedule({
    required String stopId,
    required String stopName,
    required String routeShortName,
    required String scheduledTime,
    required int minutesBefore,
    required int fireAt,
  }) async {
    await _notifications.initialize();

    final reminder = Reminder(
      id: 'gtt-${routeShortName}-$scheduledTime-${DateTime.now().millisecondsSinceEpoch}',
      stopId: stopId,
      stopName: stopName,
      routeShortName: routeShortName,
      scheduledTime: scheduledTime,
      minutesBefore: minutesBefore,
      fireAt: fireAt,
    );

    // 1. Schedula la notifica locale PRIMA di persistere.
    //    Se l'orario è già passato lancia eccezione e non salviamo nulla.
    await _scheduleLocalNotification(reminder);

    // 2. Persiste solo dopo scheduling riuscito.
    await _persist(reminder);

    // 3. Prova anche FCM come bonus (best-effort, non bloccante).
    _scheduleRemote(reminder).ignore();

    return reminder;
  }

  Future<bool> _scheduleRemote(Reminder reminder) async {
    try {
      final token = await _notifications.getFcmToken();
      if (token == null || token.isEmpty) {
        debugPrint('[GTT_REMINDER] FCM token non disponibile, skip remote scheduling');
        return false;
      }
      await _remindersApi.scheduleFcm(
        fcmToken: token,
        title: '⏰ Linea ${reminder.routeShortName} — GTT',
        body:
            'Tra ${reminder.minutesBefore} min: ${reminder.routeShortName} → corsa delle ${reminder.scheduledTime}',
        tag: reminder.id,
        fireAt: reminder.fireAt,
      );
      debugPrint('[GTT_REMINDER] FCM schedulato sul backend OK');
      return true;
    } catch (e) {
      debugPrint('[GTT_REMINDER] FCM backend non disponibile: $e (il Timer locale gestisce la notifica)');
      return false;
    }
  }

  Future<void> _scheduleLocalNotification(Reminder reminder) async {
    final fireAt = DateTime.fromMillisecondsSinceEpoch(reminder.fireAt);
    if (fireAt.isBefore(DateTime.now())) {
      throw Exception(
        'Troppo tardi: la corsa parte tra meno di ${reminder.minutesBefore} min. '
        'Seleziona un intervallo più breve.',
      );
    }

    await _notifications.scheduleLocalNotification(
      id: reminder.id.hashCode,
      title: '⏰ Linea ${reminder.routeShortName} — GTT',
      body:
          'Tra ${reminder.minutesBefore} min: ${reminder.routeShortName} → corsa delle ${reminder.scheduledTime}',
      fireAt: fireAt,
      tag: reminder.id,
    );
  }

  Future<void> cancel(String reminderId) async {
    await _notifications.cancelNotification(reminderId.hashCode);
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_kRemindersKey) ?? [];
    final updated = list.where((s) {
      final r = Reminder.fromJson(jsonDecode(s) as Map<String, dynamic>);
      return r.id != reminderId;
    }).toList();
    await prefs.setStringList(_kRemindersKey, updated);
  }

  Future<void> _persist(Reminder reminder) async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_kRemindersKey) ?? [];
    list.add(jsonEncode(reminder.toJson()));
    await prefs.setStringList(_kRemindersKey, list);
  }

  Future<void> restorePendingLocalNotifications() async {
    await _notifications.initialize();
    final reminders = await loadAll();
    for (final reminder in reminders) {
      if (DateTime.fromMillisecondsSinceEpoch(reminder.fireAt)
          .isAfter(DateTime.now())) {
        await _scheduleLocalNotification(reminder);
      }
    }
  }

  void dispose() {}
}

final reminderServiceProvider = Provider<ReminderService>((ref) {
  final service = ReminderService(
    ref.watch(notificationServiceProvider),
    ref.watch(remindersApiProvider),
  );
  unawaited(service.restorePendingLocalNotifications());
  ref.onDispose(service.dispose);
  return service;
});
