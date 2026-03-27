import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/journey_api.dart';
import '../../core/api/stops_api.dart';
import '../../core/models/itinerary.dart';
import '../../core/models/stop.dart';
import '../../core/providers/location_provider.dart';
import '../../core/theme/colors.dart';
import '../../widgets/bottom_nav.dart';
import '../../widgets/route_chip.dart';
import 'journey_provider.dart';

class JourneyPlannerScreen extends ConsumerStatefulWidget {
  const JourneyPlannerScreen({super.key});

  @override
  ConsumerState<JourneyPlannerScreen> createState() =>
      _JourneyPlannerScreenState();
}

class _JourneyPlannerScreenState extends ConsumerState<JourneyPlannerScreen> {
  @override
  Widget build(BuildContext context) {
    final planState = ref.watch(journeyPlanProvider).valueOrNull ??
        const JourneyPlanState();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pianifica tragitto',
            style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: Column(
        children: [
          // From/To pickers
          _EndpointSection(state: planState),
          const Divider(height: 1),
          // Results
          Expanded(
            child: planState.loading
                ? const Center(child: CircularProgressIndicator())
                : planState.error != null
                    ? _ErrorView(message: planState.error!)
                    : planState.results.isEmpty
                        ? _emptyHint(planState)
                        : _ItineraryList(itineraries: planState.results),
          ),
        ],
      ),
      bottomNavigationBar: const BottomNav(currentIndex: 2),
    );
  }

  Widget _emptyHint(JourneyPlanState state) {
    if (!state.canSearch) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.route_outlined, size: 56, color: AppColors.text3),
            SizedBox(height: 12),
            Text(
              'Seleziona partenza e arrivo',
              style: TextStyle(color: AppColors.text3, fontSize: 15),
            ),
          ],
        ),
      );
    }
    return const Center(
      child: Text('Nessun tragitto trovato', style: TextStyle(color: AppColors.text3)),
    );
  }
}

class _EndpointSection extends ConsumerWidget {
  final JourneyPlanState state;
  const _EndpointSection({required this.state});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Icone verticali
          Column(
            children: [
              const Icon(Icons.my_location, color: AppColors.brand, size: 20),
              Container(
                  width: 2, height: 28, color: AppColors.divider),
              const Icon(Icons.location_on, color: Color(0xFFE8431B), size: 20),
            ],
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              children: [
                _StopPickerField(
                  label: 'Partenza',
                  selected: state.from,
                  onPick: (e) => ref.read(journeyPlanProvider.notifier).setFrom(e),
                ),
                const SizedBox(height: 8),
                _StopPickerField(
                  label: 'Arrivo',
                  selected: state.to,
                  onPick: (e) => ref.read(journeyPlanProvider.notifier).setTo(e),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    // Swap
                    OutlinedButton.icon(
                      onPressed: () =>
                          ref.read(journeyPlanProvider.notifier).swap(),
                      icon: const Icon(Icons.swap_vert, size: 18),
                      label: const Text('Inverti'),
                      style: OutlinedButton.styleFrom(
                        visualDensity: VisualDensity.compact,
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Search
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: state.canSearch
                            ? () => ref.read(journeyPlanProvider.notifier).search()
                            : null,
                        icon: const Icon(Icons.search, size: 18),
                        label: const Text('Cerca'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StopPickerField extends ConsumerStatefulWidget {
  final String label;
  final JourneyEndpoint? selected;
  final ValueChanged<JourneyEndpoint?> onPick;

  const _StopPickerField({
    required this.label,
    this.selected,
    required this.onPick,
  });

  @override
  ConsumerState<_StopPickerField> createState() => _StopPickerFieldState();
}

class _StopPickerFieldState extends ConsumerState<_StopPickerField> {
  late TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.selected?.stopName ?? '');
  }

  @override
  void didUpdateWidget(_StopPickerField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.selected?.stopName != oldWidget.selected?.stopName) {
      _ctrl.text = widget.selected?.stopName ?? '';
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Autocomplete<Stop>(
      displayStringForOption: (s) => s.stopName,
      optionsBuilder: (value) async {
        if (value.text.length < 2) return [];
        try {
          return await ref.read(stopsApiProvider).search(value.text);
        } catch (_) {
          return [];
        }
      },
      onSelected: (stop) {
        widget.onPick(JourneyEndpoint(
          stopId: stop.stopId,
          stopName: stop.stopName,
        ));
      },
      fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
        return TextField(
          controller: controller,
          focusNode: focusNode,
          decoration: InputDecoration(
            labelText: widget.label,
            prefixIcon: Icon(
              widget.label == 'Partenza' ? Icons.my_location : Icons.location_on,
              size: 18,
            ),
            suffixIcon: controller.text.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear, size: 16),
                    onPressed: () {
                      controller.clear();
                      widget.onPick(null);
                    },
                  )
                : null,
          ),
        );
      },
    );
  }
}

class _ItineraryList extends StatelessWidget {
  final List<Itinerary> itineraries;
  const _ItineraryList({required this.itineraries});

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: itineraries.length,
      itemBuilder: (_, i) => _ItineraryCard(
        itinerary: itineraries[i],
        onTap: () => context.push('/journey/itinerary', extra: itineraries[i]),
      ),
    );
  }
}

class _ItineraryCard extends StatelessWidget {
  final Itinerary itinerary;
  final VoidCallback onTap;

  const _ItineraryCard({required this.itinerary, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final it = itinerary;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.divider),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  '${it.departureTime} → ${it.arrivalTime}',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                ),
                const Spacer(),
                if (it.fastest)
                  _Badge('Più veloce', AppColors.brand, Colors.white),
                if (it.fewestTransfers)
                  _Badge('Meno cambi', AppColors.onTime, Colors.white),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Text(
                  '${it.durationMinutes} min',
                  style: const TextStyle(color: AppColors.text2, fontSize: 13),
                ),
                const SizedBox(width: 8),
                Text(
                  it.transfers == 0
                      ? 'Diretto'
                      : '${it.transfers} cambio${it.transfers > 1 ? 'i' : ''}',
                  style: const TextStyle(color: AppColors.text3, fontSize: 13),
                ),
              ],
            ),
            const SizedBox(height: 8),
            // Legs chips
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: it.legs
                  .where((l) => l.isTransit)
                  .map((l) => RouteChip(
                        shortName: l.routeShortName ?? '?',
                        color: l.routeColor,
                        textColor: l.routeTextColor,
                      ))
                  .toList(),
            ),
          ],
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  final String label;
  final Color bg;
  final Color fg;
  const _Badge(this.label, this.bg, this.fg);

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(left: 4),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration:
            BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
        child: Text(label,
            style: TextStyle(
                color: fg, fontSize: 10, fontWeight: FontWeight.w700)),
      );
}

class _ErrorView extends StatelessWidget {
  final String message;
  const _ErrorView({required this.message});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: AppColors.delayHeavy),
              const SizedBox(height: 12),
              Text(message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.text2)),
            ],
          ),
        ),
      );
}
