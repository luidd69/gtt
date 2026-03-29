import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/models/arrival.dart';
import '../../core/services/reminder_service.dart';
import '../../core/theme/colors.dart';
import '../../widgets/route_chip.dart';
import '../../widgets/delay_badge.dart';

const _reminderMinOptions = [2, 5, 10, 15];

class ArrivalRow extends ConsumerStatefulWidget {
  final Arrival arrival;
  final String stopId;
  final String stopName;
  final bool isScheduledMode;

  const ArrivalRow({
    super.key,
    required this.arrival,
    required this.stopId,
    required this.stopName,
    this.isScheduledMode = false,
  });

  @override
  ConsumerState<ArrivalRow> createState() => _ArrivalRowState();
}

class _ArrivalRowState extends ConsumerState<ArrivalRow> {
  bool _showReminder = false;
  bool _reminderScheduled = false;
  int _selectedMins = 5;

  String _formatWait() {
    if (widget.arrival.waitMinutes != null) {
      final w = widget.arrival.waitMinutes!;
      if (w <= 0) return 'In arrivo';
      if (w == 1) return '1 min';
      return '$w min';
    }
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
      final msg = e.toString().replaceFirst('Exception: ', '');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: AppColors.delayHeavy,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.arrival;
    final waitStr = _formatWait();

    // Colore ETA in base al ritardo
    Color etaColor = AppColors.text1;
    if (a.canceled) {
      etaColor = AppColors.delayHeavy;
    } else if (a.isRealtime) {
      final d = a.delaySeconds ?? 0;
      if (d > 300) etaColor = AppColors.delayHeavy;
      else if (d > 60) etaColor = AppColors.delayLight;
      else etaColor = AppColors.onTime;
    }

    return Column(
      children: [
        InkWell(
          onTap: a.tripId != null && !a.canceled
              ? () => context.push(
                    '/trips/${Uri.encodeComponent(a.tripId!)}?fromStop=${Uri.encodeQueryComponent(widget.stopId)}',
                  )
              : null,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
            child: Row(
              children: [
                RouteChip(
                  shortName: a.routeShortName,
                  color: a.canceled ? null : a.routeColor,
                  textColor: a.routeTextColor,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        a.headsign,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                          decoration: a.canceled ? TextDecoration.lineThrough : null,
                          color: a.canceled ? AppColors.text3 : AppColors.text1,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (waitStr.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          waitStr,
                          style: const TextStyle(
                            color: AppColors.text3,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                if (a.canceled)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: AppColors.delayHeavyBg,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text('Annullata',
                        style: TextStyle(
                            color: AppColors.delayHeavy,
                            fontSize: 12,
                            fontWeight: FontWeight.w700)),
                  )
                else
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (a.nextDay)
                            Container(
                              margin: const EdgeInsets.only(right: 4),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 4, vertical: 1),
                              decoration: BoxDecoration(
                                color: AppColors.text3.withAlpha(40),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text('+1',
                                  style: TextStyle(
                                      fontSize: 9,
                                      color: AppColors.text3,
                                      fontWeight: FontWeight.w700)),
                            ),
                          Text(
                            a.displayTime,
                            style: TextStyle(
                              color: etaColor,
                              fontWeight: FontWeight.w800,
                              fontSize: 20,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      DelayBadge(
                        delaySeconds: a.delaySeconds,
                        isRealtime: a.isRealtime,
                      ),
                    ],
                  ),
                const SizedBox(width: 4),
                if (a.tripId != null && a.tripId!.isNotEmpty && !a.canceled && !widget.isScheduledMode)
                  IconButton(
                    icon: const Icon(Icons.location_searching,
                        size: 20, color: AppColors.text3),
                    tooltip: 'Segui veicolo in mappa',
                    onPressed: () => context.push(
                      '/map?tripId=${Uri.encodeQueryComponent(a.tripId!)}',
                    ),
                    visualDensity: VisualDensity.compact,
                    padding: EdgeInsets.zero,
                  ),
                const SizedBox(width: 2),
                if (!a.canceled)
                  IconButton(
                    icon: Icon(
                      _reminderScheduled
                          ? Icons.notifications_active_rounded
                          : Icons.notifications_none_rounded,
                      color: _reminderScheduled
                          ? AppColors.brand
                          : AppColors.text3,
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
        const Divider(height: 1, indent: 16),
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
              Icon(Icons.alarm, size: 16,
                  color: Theme.of(context).colorScheme.onSurfaceVariant),
              const SizedBox(width: 6),
              Text(
                'Avvisami prima delle $scheduledTime',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
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
          Wrap(
            spacing: 6,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              ..._reminderMinOptions.map((m) => ChoiceChip(
                    label: Text('$m min'),
                    selected: selectedMins == m,
                    onSelected: (_) => onMinsChanged(m),
                    visualDensity: VisualDensity.compact,
                  )),
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
