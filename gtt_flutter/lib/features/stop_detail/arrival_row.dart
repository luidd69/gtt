import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/models/arrival.dart';
import '../../core/models/reminder.dart';
import '../../core/services/reminder_service.dart';
import '../../core/theme/colors.dart';
import '../../widgets/route_chip.dart';
import '../../widgets/delay_badge.dart';

const _reminderMinOptions = [2, 5, 10, 15];

class ArrivalRow extends ConsumerStatefulWidget {
  final Arrival arrival;
  final String stopId;
  final String stopName;

  const ArrivalRow({
    super.key,
    required this.arrival,
    required this.stopId,
    required this.stopName,
  });

  @override
  ConsumerState<ArrivalRow> createState() => _ArrivalRowState();
}

class _ArrivalRowState extends ConsumerState<ArrivalRow> {
  bool _showReminder = false;
  bool _reminderScheduled = false;
  int _selectedMins = 5;

  String _formatWait() {
    final timeStr = widget.arrival.displayTime;
    if (timeStr.isEmpty) return '';
    try {
      final parts = timeStr.split(':');
      final h = int.parse(parts[0]);
      final m = int.parse(parts[1]);
      final now = DateTime.now();
      var target = DateTime(now.year, now.month, now.day, h, m);
      if (target.isBefore(now)) target = target.add(const Duration(days: 1));
      final diff = target.difference(now).inMinutes;
      if (diff <= 0) return 'In arrivo';
      if (diff == 1) return '1 min';
      return '$diff min';
    } catch (_) {
      return '';
    }
  }

  Future<void> _scheduleReminder() async {
    final a = widget.arrival;
    try {
      final parts = a.scheduledTime.split(':');
      final h = int.parse(parts[0]);
      final m = int.parse(parts[1]);
      final now = DateTime.now();
      var target = DateTime(now.year, now.month, now.day, h, m);
      if (target.isBefore(now)) target = target.add(const Duration(days: 1));
      target = target.subtract(Duration(minutes: _selectedMins));

      await ref.read(reminderServiceProvider).schedule(
            stopId: widget.stopId,
            stopName: widget.stopName,
            routeShortName: a.routeShortName,
            scheduledTime: a.scheduledTime,
            minutesBefore: _selectedMins,
            fireAt: target.millisecondsSinceEpoch,
          );
      setState(() => _reminderScheduled = true);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Errore: ${e.toString()}')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.arrival;

    return Column(
      children: [
        InkWell(
          onTap: a.tripId != null
              ? () => context.push('/trips/${a.tripId}')
              : null,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                RouteChip(
                  shortName: a.routeShortName,
                  color: a.routeColor,
                  textColor: a.routeTextColor,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    a.headsign,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w500,
                        ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      a.displayTime,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                            fontSize: 18,
                          ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _formatWait(),
                          style: const TextStyle(
                            color: AppColors.text3,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(width: 6),
                        DelayBadge(
                          delaySeconds: a.delaySeconds,
                          isRealtime: a.isRealtime,
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(width: 4),
                IconButton(
                  icon: Icon(
                    _reminderScheduled
                        ? Icons.notifications_active_rounded
                        : Icons.notifications_none_rounded,
                    color: _reminderScheduled ? AppColors.brand : AppColors.text3,
                    size: 22,
                  ),
                  onPressed: () =>
                      setState(() => _showReminder = !_showReminder),
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                ),
              ],
            ),
          ),
        ),
        if (_showReminder)
          _ReminderPanel(
            scheduledTime: a.scheduledTime,
            routeShortName: a.routeShortName,
            selectedMins: _selectedMins,
            scheduled: _reminderScheduled,
            onMinsChanged: (m) => setState(() => _selectedMins = m),
            onSchedule: _scheduleReminder,
            onClose: () => setState(() => _showReminder = false),
          ),
        const Divider(height: 1),
      ],
    );
  }
}

class _ReminderPanel extends StatelessWidget {
  final String scheduledTime;
  final String routeShortName;
  final int selectedMins;
  final bool scheduled;
  final ValueChanged<int> onMinsChanged;
  final VoidCallback onSchedule;
  final VoidCallback onClose;

  const _ReminderPanel({
    required this.scheduledTime,
    required this.routeShortName,
    required this.selectedMins,
    required this.scheduled,
    required this.onMinsChanged,
    required this.onSchedule,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    if (scheduled) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        color: AppColors.onTimeBg,
        child: Row(
          children: [
            const Text('✅', style: TextStyle(fontSize: 16)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Reminder $selectedMins min prima delle $scheduledTime',
                style: const TextStyle(
                  color: AppColors.onTime,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
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
      );
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.alarm, size: 16, color: AppColors.text2),
              const SizedBox(width: 6),
              Text(
                'Avvisami prima delle $scheduledTime',
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                  color: AppColors.text2,
                ),
              ),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.close, size: 18, color: AppColors.text3),
                onPressed: onClose,
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              ..._reminderMinOptions.map((m) => Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      label: Text('$m min'),
                      selected: selectedMins == m,
                      onSelected: (_) => onMinsChanged(m),
                      visualDensity: VisualDensity.compact,
                    ),
                  )),
              const Spacer(),
              FilledButton(
                onPressed: onSchedule,
                child: const Text('Imposta'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
