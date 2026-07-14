import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/router/route_names.dart';
import '../../../../../core/theme/app_colours.dart';
import '../../../../../core/utils/format_utils.dart';
import '../../../../../core/widgets/empty_state.dart';
import '../../../../../core/widgets/error_state.dart';
import '../../../../../core/widgets/loading_shimmer.dart';
import '../../../../../core/widgets/search_bar_delegate.dart';
import '../../../../../core/widgets/status_badge.dart';
import '../../providers/stock_issue_provider.dart';

class StockIssueListScreen extends ConsumerWidget {
  const StockIssueListScreen({super.key});

  static const _statuses = ['', 'DRAFT', 'POSTED', 'CANCELLED'];
  static const _labels   = ['All', 'Draft', 'Posted', 'Cancelled'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(stockIssueStatusFilterProvider);
    final async    = ref.watch(stockIssueListProvider);

    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('Stock Issues'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => context.goNamed(RouteNames.stockIssueNew),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: ErpSearchBar(
              hintText: 'Search stock issues…',
              onChanged: (v) =>
                  ref.read(stockIssueSearchProvider.notifier).state = v,
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: List.generate(
                _statuses.length,
                (i) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(_labels[i]),
                    selected: selected == _statuses[i],
                    onSelected: (_) => ref
                        .read(stockIssueStatusFilterProvider.notifier)
                        .state = _statuses[i],
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(stockIssueListProvider),
              child: async.when(
                loading: () => const LoadingShimmer(),
                error: (e, _) => ErrorState(
                  message: e.toString(),
                  onRetry: () => ref.invalidate(stockIssueListProvider),
                ),
                data: (items) => items.isEmpty
                    ? const EmptyState(
                        message: 'No stock issues found.',
                        icon: Icons.outbox_outlined,
                      )
                    : NotificationListener<ScrollNotification>(
                        onNotification: (n) {
                          if (n.metrics.pixels >=
                              n.metrics.maxScrollExtent - 200) {
                            ref
                                .read(stockIssueListProvider.notifier)
                                .loadMore();
                          }
                          return false;
                        },
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: items.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (ctx, i) {
                            final si = items[i];
                            return InkWell(
                              onTap: () => context.goNamed(
                                RouteNames.stockIssueDetail,
                                pathParameters: {'id': si.id},
                              ),
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: AppColours.surface,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                      color: AppColours.cardBorder),
                                ),
                                child: Row(children: [
                                  Container(
                                    width: 44, height: 44,
                                    decoration: BoxDecoration(
                                      color: AppColours.primary.withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Icon(Icons.outbox_outlined,
                                        color: AppColours.primary, size: 22),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(si.docNo,
                                            style: const TextStyle(
                                                fontWeight: FontWeight.bold,
                                                fontSize: 13)),
                                        const SizedBox(height: 2),
                                        Text(si.issuedToName,
                                            style: const TextStyle(
                                                fontSize: 12,
                                                color: AppColours.textSecondary)),
                                        const SizedBox(height: 4),
                                        Text(si.warehouseName,
                                            style: const TextStyle(
                                                fontSize: 11,
                                                color: AppColours.textHint)),
                                      ],
                                    ),
                                  ),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      StatusBadge(status: si.status),
                                      const SizedBox(height: 4),
                                      Text(
                                        FormatUtils.formatDate(
                                            FormatUtils.parseDate(si.docDate)),
                                        style: const TextStyle(
                                            fontSize: 11,
                                            color: AppColours.textSecondary),
                                      ),
                                    ],
                                  ),
                                ]),
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
