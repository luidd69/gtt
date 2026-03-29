import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart' show launchUrl, LaunchMode;
import '../../core/api/service_api.dart';
import '../../core/theme/colors.dart';
import '../../widgets/bottom_nav.dart';
import '../../widgets/loading_shimmer.dart';

final _serviceStatusInfoProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(serviceApiProvider).getStatus(),
);
final _gtfsInfoProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(serviceApiProvider).getGtfsInfo(),
);

class InfoScreen extends ConsumerWidget {
  const InfoScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statusAsync = ref.watch(_serviceStatusInfoProvider);
    final gtfsAsync = ref.watch(_gtfsInfoProvider);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.brand,
        foregroundColor: Colors.white,
        title: const Text('Info servizio',
            style: TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(_serviceStatusInfoProvider),
          ),
        ],
      ),
      body: statusAsync.when(
        data: (status) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Status gtfs
            _StatusCard(
                loaded: status.gtfsLoaded, lastUpdated: status.gtfsLastUpdated),
            const SizedBox(height: 8),
            gtfsAsync.maybeWhen(
              data: (g) => _GtfsStatsCard(info: g),
              orElse: () => const SizedBox.shrink(),
            ),
            const SizedBox(height: 16),
            // Alerts
            if (status.alerts.isNotEmpty) ...[
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  'Avvisi attivi (${status.alerts.length})',
                  style: Theme.of(context)
                      .textTheme
                      .titleSmall
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              ...status.alerts.map((a) => _AlertCard(alert: a)),
            ] else
              const _NoAlertsView(),
            const SizedBox(height: 80),
          ],
        ),
        loading: () => ListView(
          padding: const EdgeInsets.all(16),
          children: List.generate(
            4,
            (_) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: LoadingShimmer.card(),
            ),
          ),
        ),
        error: (e, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline,
                  size: 48, color: AppColors.delayHeavy),
              const SizedBox(height: 12),
              Text('Errore: $e',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.text2)),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => ref.invalidate(_serviceStatusInfoProvider),
                child: const Text('Riprova'),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: const BottomNav(currentIndex: 4),
    );
  }
}

class _StatusCard extends StatelessWidget {
  final bool loaded;
  final String? lastUpdated;

  const _StatusCard({required this.loaded, this.lastUpdated});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: loaded ? AppColors.onTimeBg : AppColors.delayHeavyBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: loaded
              ? AppColors.onTime.withAlpha(80)
              : AppColors.delayHeavy.withAlpha(80),
        ),
      ),
      child: Row(
        children: [
          Icon(
            loaded ? Icons.check_circle_outline : Icons.warning_amber_rounded,
            color: loaded ? AppColors.onTime : AppColors.delayHeavy,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  loaded ? 'Dati GTFS caricati' : 'Dati GTFS non disponibili',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: loaded ? AppColors.onTime : AppColors.delayHeavy,
                  ),
                ),
                if (lastUpdated != null)
                  Text(
                    'Aggiornato: $lastUpdated',
                    style:
                        const TextStyle(color: AppColors.text2, fontSize: 12),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AlertCard extends StatelessWidget {
  final ServiceAlert alert;
  const _AlertCard({required this.alert});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.delayLightBg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('⚠️'),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  alert.title,
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 14),
                ),
              ),
            ],
          ),
          if (alert.description != null && alert.description!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              alert.description!,
              style: const TextStyle(color: AppColors.text2, fontSize: 13),
            ),
          ],
          if (alert.url != null) ...[
            const SizedBox(height: 8),
            GestureDetector(
              onTap: () => launchUrl(
                Uri.parse(alert.url!),
                mode: LaunchMode.externalApplication,
              ),
              child: const Text(
                'Dettagli →',
                style: TextStyle(
                  color: AppColors.brand,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _NoAlertsView extends StatelessWidget {
  const _NoAlertsView();

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: AppColors.onTimeBg,
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Row(
          children: [
            Text('✅', style: TextStyle(fontSize: 24)),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'Nessuna perturbazione in corso',
                style: TextStyle(
                  color: AppColors.onTime,
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                ),
              ),
            ),
          ],
        ),
      );
}

class _GtfsStatsCard extends StatelessWidget {
  final GtfsInfo info;
  const _GtfsStatsCard({required this.info});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.divider),
      ),
      child: Wrap(
        spacing: 12,
        runSpacing: 8,
        children: [
          _Stat('Fermate', info.stops),
          _Stat('Linee', info.routes),
          _Stat('Corse', info.trips),
          _Stat('StopTimes', info.stopTimes),
          _Stat('Realtime', info.realtimeEnabled == true ? 1 : 0,
              labels: const ['No', 'Si']),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final String name;
  final int? value;
  final List<String>? labels;
  const _Stat(this.name, this.value, {this.labels});

  @override
  Widget build(BuildContext context) {
    final text = labels != null
        ? ((value != null && value! >= 0 && value! < labels!.length)
            ? labels![value!]
            : '--')
        : (value?.toString() ?? '--');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(name,
            style: const TextStyle(fontSize: 11, color: AppColors.text3)),
        Text(text, style: const TextStyle(fontWeight: FontWeight.w700)),
      ],
    );
  }
}
