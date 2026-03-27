import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/reminder.dart';
import '../../../core/services/reminder_service.dart';

class RemindersNotifier extends AsyncNotifier<List<Reminder>> {
  @override
  Future<List<Reminder>> build() async {
    return ref.watch(reminderServiceProvider).loadAll();
  }

  Future<void> cancel(String reminderId) async {
    await ref.read(reminderServiceProvider).cancel(reminderId);
    state = AsyncData(
      (state.valueOrNull ?? []).where((r) => r.id != reminderId).toList(),
    );
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = AsyncData(await ref.read(reminderServiceProvider).loadAll());
  }
}

final remindersProvider =
    AsyncNotifierProvider.autoDispose<RemindersNotifier, List<Reminder>>(
  RemindersNotifier.new,
);
