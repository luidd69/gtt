import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/providers/favorites_provider.dart';
import '../../core/theme/colors.dart';
import '../../widgets/bottom_nav.dart';
import '../../widgets/loading_shimmer.dart';
import '../../widgets/route_chip.dart';
import 'arrivals_provider.dart';
import 'arrival_row.dart';

class StopDetailScreen extends ConsumerStatefulWidget {
  final String stopId;
  const StopDetailScreen({super.key, required this.stopId});

  @override
  ConsumerState<StopDetailScreen> createState() => _StopDetailScreenState();
}

class _StopDetailScreenState extends ConsumerState<StopDetailScreen> {
  // null = modalità live, valorizzato = orario programmato
  DateTime? _customDateTime;

  String get _apiDate =>
      _customDateTime != null ? DateFormat('yyyy-MM-dd').format(_customDateTime!) : '';
  String get _apiTime =>
      _customDateTime != null ? DateFormat('HH:mm').format(_customDateTime!) : '';

  Future<void> _pickDateTime(BuildContext context) async {
    final now = DateTime.now();
    final initialDate = _customDateTime ?? now;

    final date = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: now.subtract(const Duration(days: 1)),
      lastDate: now.add(const Duration(days: 30)),
      locale: const Locale('it', 'IT'),
      helpText: 'Seleziona giorno',
    );
    if (date == null || !mounted) return;

    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initialDate),
      helpText: 'Seleziona orario',
    );
    if (time == null || !mounted) return;

    setState(() {
      _customDateTime = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    });
  }

  @override
  Widget build(BuildContext context) {
    final stopId = widget.stopId;
    final stopAsync = ref.watch(stopDetailProvider(stopId));
    final favAsync = ref.watch(favoritesProvider);
    final isFav = favAsync.valueOrNull?.favorites.any((f) => f.stopId == stopId) ?? false;

    // Scegli il provider giusto in base alla modalità
    final AsyncValue arrivalsAsync = _customDateTime == null
        ? ref.watch(arrivalsStreamProvider(stopId))
        : ref.watch(arrivalsCustomTimeProvider(
            (stopId: stopId, date: _apiDate, time: _apiTime)));

    final isCustomMode = _customDateTime != null;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // ─── Branded header ───────────────────────────────────────────────
          SliverAppBar(
            pinned: true,
            expandedHeight: 110,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back, color: Colors.white),
              onPressed: () => context.pop(),
            ),
            backgroundColor: AppColors.brandDark,
            actions: [
              stopAsync.when(
                data: (stop) => IconButton(
                  icon: Icon(
                    isFav ? Icons.star_rounded : Icons.star_outline_rounded,
                  ),
                  color: isFav ? Colors.amber : Colors.white70,
                  onPressed: () =>
                      ref.read(favoritesProvider.notifier).toggle(stop),
                ),
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
              ),
              IconButton(
                icon: const Icon(Icons.route_rounded, color: Colors.white70),
                tooltip: 'Pianifica da qui',
                onPressed: () => context.push('/journey'),
              ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              titlePadding: const EdgeInsets.fromLTRB(54, 0, 16, 12),
              title: stopAsync.when(
                data: (stop) => Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      stop.stopName,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (stop.stopCode.isNotEmpty)
                      Text(
                        'Fermata ${stop.stopCode}',
                        style: const TextStyle(
                          color: Color(0xFFBFDBFE),
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                  ],
                ),
                loading: () => const Text('Caricamento…',
                    style: TextStyle(color: Colors.white)),
                error: (_, __) => const Text('Errore',
                    style: TextStyle(color: Colors.white)),
              ),
              background: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF1D4ED8), Color(0xFF1E40AF)],
                  ),
                ),
              ),
            ),
          ),
          // ─── Chip linee ─────────────────────────────────────────────────
          stopAsync.maybeWhen(
            data: (stop) {
              if (stop.routes.isEmpty)
                return const SliverToBoxAdapter(child: SizedBox.shrink());
              return SliverToBoxAdapter(
                child: Container(
                  color: AppColors.surface1,
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  child: Wrap(
                    spacing: 6,
                    runSpacing: 8,
                    children: stop.routes
                        .map((r) => GestureDetector(
                              onTap: () => context.push(
                                  '/lines/${Uri.encodeComponent(r.routeId)}'),
                              child: RouteChip(
                                shortName: r.shortName,
                                color: r.color,
                                textColor: r.textColor,
                              ),
                            ))
                        .toList(),
                  ),
                ),
              );
            },
            orElse: () => const SliverToBoxAdapter(child: SizedBox.shrink()),
          ),
          // ─── Header sezione arrivi + selettore data/ora ───────────────────
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
                  child: Row(
                    children: [
                      const Text(
                        'ARRIVI',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.text3,
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Toggle live / orario programmato
                      GestureDetector(
                        onTap: () async {
                          if (isCustomMode) {
                            setState(() => _customDateTime = null);
                          } else {
                            await _pickDateTime(context);
                          }
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: isCustomMode
                                ? AppColors.brand.withAlpha(25)
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isCustomMode ? AppColors.brand : AppColors.text3,
                              width: 1,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                isCustomMode
                                    ? Icons.calendar_today_rounded
                                    : Icons.access_time_rounded,
                                size: 12,
                                color: isCustomMode ? AppColors.brand : AppColors.text3,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                isCustomMode
                                    ? _formatCustomDate()
                                    : 'Orario programmato',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: isCustomMode ? AppColors.brand : AppColors.text3,
                                ),
                              ),
                              if (isCustomMode) ...[
                                const SizedBox(width: 4),
                                Icon(Icons.close_rounded,
                                    size: 12, color: AppColors.brand),
                              ],
                            ],
                          ),
                        ),
                      ),
                      if (isCustomMode)
                        GestureDetector(
                          onTap: () => _pickDateTime(context),
                          child: const Padding(
                            padding: EdgeInsets.only(left: 6),
                            child: Icon(Icons.edit_calendar_rounded,
                                size: 16, color: AppColors.brand),
                          ),
                        ),
                      const Spacer(),
                      if (!isCustomMode)
                        arrivalsAsync.when(
                          data: (arrivals) => _RealtimeStatusBar(
                            hasArrivals: (arrivals as List).isNotEmpty,
                            hasRealtime: (arrivals).any((a) => a.isRealtime),
                          ),
                          loading: () => const SizedBox.shrink(),
                          error: (_, __) => _RealtimeStatusBar(
                              hasArrivals: false,
                              hasRealtime: false,
                              isError: true),
                        ),
                    ],
                  ),
                ),
                // Banner data/ora quando in modalità programmata
                if (isCustomMode)
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.brand.withAlpha(15),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.brand.withAlpha(50)),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.info_outline_rounded,
                            size: 14, color: AppColors.brand),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Orari del ${_formatFullDate()} — solo corse programmate',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppColors.brand,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          // ─── Lista arrivi ─────────────────────────────────────────────────
          arrivalsAsync.when(
            data: (arrivals) {
              final list = arrivals as List;
              if (list.isEmpty) {
                return SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Center(
                      child: Column(
                        children: [
                          const Icon(Icons.directions_bus_outlined,
                              size: 48, color: AppColors.text3),
                          const SizedBox(height: 8),
                          Text(
                            isCustomMode
                                ? 'Nessuna corsa programmata\nper questo orario'
                                : 'Nessun arrivo previsto',
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: AppColors.text3),
                          ),
                          if (isCustomMode) ...[
                            const SizedBox(height: 12),
                            TextButton.icon(
                              onPressed: () => _pickDateTime(context),
                              icon: const Icon(Icons.edit_calendar_rounded, size: 16),
                              label: const Text('Cambia orario'),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                );
              }
              return SliverList(
                delegate: SliverChildBuilderDelegate(
                  (_, i) => stopAsync.maybeWhen(
                    data: (stop) => ArrivalRow(
                      arrival: list[i],
                      stopId: stopId,
                      stopName: stop.stopName,
                      isScheduledMode: isCustomMode,
                    ),
                    orElse: () => ArrivalRow(
                      arrival: list[i],
                      stopId: stopId,
                      stopName: '',
                      isScheduledMode: isCustomMode,
                    ),
                  ),
                  childCount: list.length,
                ),
              );
            },
            loading: () => SliverList(
              delegate: SliverChildBuilderDelegate(
                (_, __) => const _ArrivalRowSkeleton(),
                childCount: 6,
              ),
            ),
            error: (e, _) => SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Center(
                  child: Text('Errore: $e',
                      style: const TextStyle(color: AppColors.delayHeavy)),
                ),
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 80)),
        ],
      ),
      bottomNavigationBar: const BottomNav(currentIndex: -1),
    );
  }

  String _formatCustomDate() {
    if (_customDateTime == null) return '';
    final days = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
    final day = days[_customDateTime!.weekday - 1];
    return '$day ${DateFormat('d/M').format(_customDateTime!)} ${DateFormat('HH:mm').format(_customDateTime!)}';
  }

  String _formatFullDate() {
    if (_customDateTime == null) return '';
    final days = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
    final day = days[_customDateTime!.weekday - 1];
    return '$day ${DateFormat('d MMMM', 'it').format(_customDateTime!)} alle ${DateFormat('HH:mm').format(_customDateTime!)}';
  }
}

class _RealtimeStatusBar extends StatelessWidget {
  final bool hasArrivals;
  final bool hasRealtime;
  final bool isError;
  const _RealtimeStatusBar({
    required this.hasArrivals,
    required this.hasRealtime,
    this.isError = false,
  });

  @override
  Widget build(BuildContext context) {
    Color dotColor;
    String label;

    if (isError) {
      dotColor = AppColors.delayHeavy;
      label = 'Non raggiungibile';
    } else if (!hasArrivals) {
      dotColor = AppColors.text3;
      label = 'Nessun dato';
    } else if (hasRealtime) {
      dotColor = AppColors.onTime;
      label = 'Live';
    } else {
      dotColor = Colors.orange;
      label = 'Orario';
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(label,
            style: TextStyle(
                fontSize: 12, color: dotColor, fontWeight: FontWeight.w600)),
      ],
    );
  }
}

class _ArrivalRowSkeleton extends StatelessWidget {
  const _ArrivalRowSkeleton();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          const LoadingShimmer(width: 44, height: 26, borderRadius: 6),
          const SizedBox(width: 10),
          Expanded(child: LoadingShimmer(width: double.infinity, height: 14)),
          const SizedBox(width: 8),
          const LoadingShimmer(width: 48, height: 22, borderRadius: 4),
        ],
      ),
    );
  }
}

