import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/models/reminder.dart';
import '../../core/services/notification_service.dart';
import '../../core/theme/colors.dart';
import '../../widgets/bottom_nav.dart';
import '../../widgets/loading_shimmer.dart';
import '../../widgets/route_chip.dart';
import 'reminders_provider.dart';

class RemindersScreen extends ConsumerWidget {
  const RemindersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final remindersAsync = ref.watch(remindersProvider);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.brand,
        foregroundColor: Colors.white,
        title: const Text('Promemoria', style: TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          // ── PULSANTE TEST ──────────────────────────────────────────────
          IconButton(
            icon: const Icon(Icons.bug_report_outlined),
            tooltip: 'Test notifica + FCM token',
            onPressed: () async {
              final svc = ref.read(notificationServiceProvider);

              // 1) Notifica IMMEDIATA (non schedulata)
              await svc.showLocalNotification(
                id: 999998,
                title: '✅ Test IMMEDIATO GTT',
                body: 'Se vedi questo, le notifiche immediate funzionano!',
              );

              // 2) Notifica schedulata a 10s
              final fireAt = DateTime.now().add(const Duration(seconds: 10));
              await svc.scheduleLocalNotification(
                id: 999999,
                title: '⏱ Test SCHEDULATO GTT',
                body: 'Notifica schedulata — arrivata dopo 10 secondi!',
                fireAt: fireAt,
              );

              // 3) Ottieni e loga il token FCM
              final token = await svc.getFcmToken();
              // ignore: avoid_print
              print('[GTT_FCM_TOKEN] $token');

              if (context.mounted) {
                showDialog(
                  context: context,
                  builder: (_) => AlertDialog(
                    title: const Text('🔔 Test Avviato'),
                    content: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('• Notifica immediata inviata'),
                        const Text('• Notifica 10s schedulata'),
                        const SizedBox(height: 12),
                        const Text('FCM Token:', style: TextStyle(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        SelectableText(
                          token ?? 'Token non disponibile',
                          style: const TextStyle(fontSize: 11),
                        ),
                      ],
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('OK'),
                      ),
                    ],
                  ),
                );
              }
            },
          ),
          // ──────────────────────────────────────────────────────────────
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
        loading: () => ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
          children: List.generate(
            5,
            (_) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: LoadingShimmer.card(),
            ),
          ),
        ),
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
              ?.copyWith(fontWeight: FontWeight.w700),
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
                Row(
                  children: [
                    RouteChip(
                      shortName: reminder.routeShortName,
                      small: true,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        reminder.scheduledTime,
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                          color: isPast
                              ? Theme.of(context).colorScheme.onSurface.withAlpha(100)
                              : Theme.of(context).colorScheme.onSurface,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  reminder.stopName,
                  style: TextStyle(
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withAlpha(isPast ? 100 : 220),
                    fontSize: 13,
                  ),
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
                      style: TextStyle(
                        fontSize: 12,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
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
            Text(
              'Nessun promemoria',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: Theme.of(context).colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Tocca ⏰ su un arrivo per impostare\nun promemoria di partenza.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
          ],
        ),
      );
}
