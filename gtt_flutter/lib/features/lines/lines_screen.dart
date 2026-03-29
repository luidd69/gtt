import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/lines_api.dart';
import '../../core/models/route_line.dart';
import '../../core/theme/colors.dart';
import '../../widgets/loading_shimmer.dart';
import '../../widgets/route_chip.dart';

final linesListProvider = FutureProvider.autoDispose<List<RouteLine>>(
  (ref) => ref.watch(linesApiProvider).getAll(),
);

class LinesScreen extends ConsumerWidget {
  const LinesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final linesAsync = ref.watch(linesListProvider);
    return Scaffold(
      backgroundColor: AppColors.surface3,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            expandedHeight: 100,
            backgroundColor: AppColors.brand,
            foregroundColor: Colors.white,
            flexibleSpace: FlexibleSpaceBar(
              titlePadding:
                  const EdgeInsets.only(left: 16, bottom: 14, right: 16),
              title: const Text(
                'Linee',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 20,
                ),
              ),
              background: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [AppColors.brandDark, AppColors.brand],
                  ),
                ),
              ),
            ),
          ),
          linesAsync.when(
            data: (lines) => SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (_, i) => _LineCard(line: lines[i]),
                  childCount: lines.length,
                ),
              ),
            ),
            loading: () => SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (_, __) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: LoadingShimmer.card(),
                  ),
                  childCount: 8,
                ),
              ),
            ),
            error: (e, _) => SliverFillRemaining(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.error_outline,
                          size: 48, color: AppColors.delayHeavy),
                      const SizedBox(height: 16),
                      Text(
                        'Impossibile caricare le linee',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '$e',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                            fontSize: 13, color: AppColors.text2),
                      ),
                      const SizedBox(height: 20),
                      FilledButton.icon(
                        onPressed: () => ref.invalidate(linesListProvider),
                        icon: const Icon(Icons.refresh),
                        label: const Text('Riprova'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LineCard extends StatelessWidget {
  final RouteLine line;

  const _LineCard({required this.line});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () =>
              context.push('/lines/${Uri.encodeComponent(line.routeId)}'),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                RouteChip(
                  shortName: line.shortName,
                  color: line.color,
                  textColor: line.textColor,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    line.longName,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.text1,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.chevron_right,
                    size: 20, color: AppColors.text3),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
