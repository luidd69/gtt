import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/models/reminder.dart';
import '../../core/theme/colors.dart';
import '../../widgets/bottom_nav.dart';
import 'reminders_provider.dart';

class RemindersScreen extends ConsumerWidget {
  const RemindersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final remindersAsync = ref.watch(remindersProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Promemoria', style: TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.read(remindersProvider.notifier).refresh(),
          ),
        ],
      ),
      body: remindersAsync.when(
        data: (reminders) {
          if (reminders.isEmpty) {
            return const _EmptyView();
          }
          // Filtra quelli ancora futuri
          final active = reminders.where((r) => !r.timeUntilFire.isNegative).toList();
          final past = reminders.where((r) => r.timeUntilFire.isNegative).toList();

          return ListView(
            children: [
              if (active.isNotEmpty) ...[
                _SectionHeader('Attivi (${active.length})'),
                ...active.map((r) => _ReminderCard(
                      reminder: r,
                      onDelete: () =>
                          ref.read(remindersProvider.notifier).cancel(r.id),
                    )),
              ],
              if (past.isNotEmpty) ...[
                _SectionHeader('Passati'),
                ...past.map((r) => _ReminderCard(
                      reminder: r,
                      isPast: true,
                      onDelete: () =>
                          ref.read(remindersProvider.notifier).cancel(r.id),
                    )),
              ],
              const SizedBox(height: 80),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text('Errore: $e',
              style: const TextStyle(color: AppColors.delayHeavy)),
        ),
      ),
      bottomNavigationBar: const BottomNav(currentIndex: -1),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader(this.title);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
        child: Text(
          title,
          style: Theme.of(context)
              .textTheme
              .titleSmall
              ?.copyWith(fontWeight: FontWeight.w700, color: AppColors.text2),
        ),
      );
}

class _ReminderCard extends StatelessWidget {
  final Reminder reminder;
  final bool isPast;
  final VoidCallback onDelete;

  const _ReminderCard({
    required this.reminder,
    required this.onDelete,
    this.isPast = false,
  });

  String _countdown() {
    final diff = reminder.timeUntilFire;
    if (diff.isNegative) return 'Passato';
    if (diff.inHours > 0) return 'Fra ${diff.inHours}h ${diff.inMinutes.remainder(60)}min';
    return 'Fra ${diff.inMinutes} min';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isPast
            ? Theme.of(context).colorScheme.surfaceContainerHighest
            : Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isPast ? AppColors.divider : AppColors.brand.withAlpha(80),
        ),
      ),
      child: Row(
        children: [
          Icon(
            isPast ? Icons.notifications_off_outlined : Icons.notifications_active_outlined,
            color: isPast ? AppColors.text3 : AppColors.brand,
            size: 28,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Linea ${reminder.routeShortName} — ${reminder.scheduledTime}',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: isPast ? AppColors.text3 : null,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  reminder.stopName,
                  style: const TextStyle(color: AppColors.text2, fontSize: 13),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(
                      Icons.alarm,
                      size: 12,
                      color: isPast ? AppColors.text3 : AppColors.brand,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      _countdown(),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: isPast ? AppColors.text3 : AppColors.brand,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${reminder.minutesBefore} min prima',
                      style: const TextStyle(fontSize: 12, color: AppColors.text3),
                    ),
                  ],
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline, color: AppColors.text3),
            onPressed: () => _confirmDelete(context),
            visualDensity: VisualDensity.compact,
            padding: EdgeInsets.zero,
          ),
        ],
      ),
    );
  }

  void _confirmDelete(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Elimina promemoria?'),
        content: Text(
            'Linea ${reminder.routeShortName} — ${reminder.scheduledTime}\n${reminder.stopName}'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Annulla')),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              onDelete();
            },
            child: const Text('Elimina', style: TextStyle(color: AppColors.delayHeavy)),
          ),
        ],
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.notifications_none, size: 64, color: AppColors.text3),
            const SizedBox(height: 16),
            const Text(
              'Nessun promemoria',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.text2,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Tocca ⏰ su un arrivo per impostare\nun promemoria di partenza.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.text3),
            ),
          ],
        ),
      );
}
