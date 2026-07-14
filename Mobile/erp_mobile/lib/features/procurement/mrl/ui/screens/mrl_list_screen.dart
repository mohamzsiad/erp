import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/router/route_names.dart';
import '../../../../../core/theme/app_colours.dart';
import '../../../../../core/utils/format_utils.dart';
import '../../../../../core/widgets/document_list_tile.dart';
import '../../../../../core/widgets/empty_state.dart';
import '../../../../../core/widgets/error_state.dart';
import '../../../../../core/widgets/loading_shimmer.dart';
import '../../../../../core/widgets/search_bar_delegate.dart';
import '../../providers/mrl_provider.dart';

class MrlListScreen extends ConsumerWidget {
  const MrlListScreen({super.key});

  static const _statusFilters = ['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];
  static const _statusLabels  = ['All', 'Draft', 'Submitted', 'Approved', 'Rejected'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(mrlStatusFilterProvider);
    final async    = ref.watch(mrlListProvider);

    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('Material Requisitions'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => context.goNamed(RouteNames.mrlNew),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: ErpSearchBar(
              hintText: 'Search MRL…',
              onChanged: (v) =>
                  ref.read(mrlSearchProvider.notifier).state = v,
            ),
          ),
          // Status chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: List.generate(
                _statusFilters.length,
                (i) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(_statusLabels[i]),
                    selected: selected == _statusFilters[i],
                    onSelected: (_) => ref
                        .read(mrlStatusFilterProvider.notifier)
                        .state = _statusFilters[i],
                  ),
                ),
              ),
            ),
          ),
          // List
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(mrlListProvider),
              child: async.when(
                loading: () => const LoadingShimmer(),
                error: (e, _) => ErrorState(
                  message: e.toString(),
                  onRetry: () => ref.invalidate(mrlListProvider),
                ),
                data: (items) => items.isEmpty
                    ? const EmptyState(
                        message: 'No material requisitions found.',
                        icon: Icons.assignment_outlined,
                      )
                    : NotificationListener<ScrollNotification>(
                        onNotification: (n) {
                          if (n.metrics.pixels >=
                              n.metrics.maxScrollExtent - 200) {
                            ref.read(mrlListProvider.notifier).loadMore();
                          }
                          return false;
                        },
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: items.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (ctx, i) {
                            final mrl = items[i];
                            final total = mrl.lines.fold<double>(
                              0,
                              (s, l) => s + l.requestedQty * l.approxPrice,
                            );
                            return DocumentListTile(
                              docType: 'MRL',
                              docNo: mrl.docNo,
                              status: mrl.status,
                              subtitle: mrl.locationName ?? 'No location',
                              date: FormatUtils.formatDate(
                                  FormatUtils.parseDate(mrl.docDate)),
                              amount: total > 0 ? total : null,
                              onTap: () => context.goNamed(
                                RouteNames.mrlDetail,
                                pathParameters: {'id': mrl.id},
                              ),
                            );
                          },
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
