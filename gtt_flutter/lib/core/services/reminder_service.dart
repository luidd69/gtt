import 'dart:async';
import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/reminder.dart';
import 'notification_service.dart';

const _kRemindersKey = 'gtt_reminders';

class ReminderService {
  final NotificationService _notifications;
  final List<Timer> _timers = [];

  ReminderService(this._notifications);

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
    final reminder = Reminder(
      id: 'gtt-${routeShortName}-$scheduledTime-${DateTime.now().millisecondsSinceEpoch}',
      stopId: stopId,
      stopName: stopName,
      routeShortName: routeShortName,
      scheduledTime: scheduledTime,
      minutesBefore: minutesBefore,
      fireAt: fireAt,
    );

    await _persist(reminder);
    _scheduleLocalTimer(reminder);
    return reminder;
  }

  void _scheduleLocalTimer(Reminder reminder) {
    final delay = reminder.timeUntilFire;
    if (delay.isNegative) return;

    final timer = Timer(delay, () async {
      await _notifications.showLocalNotification(
        id: reminder.id.hashCode,
        title: '⏰ Linea ${reminder.routeShortName} — GTT',
        body: 'Tra ${reminder.minutesBefore} min: ${reminder.routeShortName} → corsa delle ${reminder.scheduledTime}',
        tag: reminder.id,
      );
    });
    _timers.add(timer);
  }

  Future<void> cancel(String reminderId) async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_kRemindersKey) ?? [];
    final updated = list
        .where((s) {
          final r = Reminder.fromJson(jsonDecode(s) as Map<String, dynamic>);
          return r.id != reminderId;
        })
        .toList();
    await prefs.setStringList(_kRemindersKey, updated);
  }

  Future<void> _persist(Reminder reminder) async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_kRemindersKey) ?? [];
    list.add(jsonEncode(reminder.toJson()));
    await prefs.setStringList(_kRemindersKey, list);
  }

  void dispose() {
    for (final t in _timers) t.cancel();
    _timers.clear();
  }
}

final reminderServiceProvider = Provider<ReminderService>((ref) {
  final service = ReminderService(ref.watch(notificationServiceProvider));
  ref.onDispose(service.dispose);
  return service;
});
