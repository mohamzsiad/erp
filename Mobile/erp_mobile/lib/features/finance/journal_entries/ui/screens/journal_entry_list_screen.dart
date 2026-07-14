import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/router/route_names.dart';
import '../../../../../core/theme/app_colours.dart';
import '../../../../../core/utils/format_utils.dart';
import '../../../../../core/widgets/amount_text.dart';
import '../../../../../core/widgets/empty_state.dart';
import '../../../../../core/widgets/error_state.dart';
import '../../../../../core/widgets/loading_shimmer.dart';
import '../../../../../core/widgets/search_bar_delegate.dart';
import '../../../../../core/widgets/status_badge.dart';
import '../../providers/journal_entry_provider.dart';

class JournalEntryListScreen extends ConsumerWidget {
  const JournalEntryListScreen({super.key});

  static const _statuses = ['', 'DRAFT', 'POSTED', 'REVERSED'];
  static const _labels   = ['All', 'Draft', 'Posted', 'Reversed'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(jeStatusFilterProvider);
    final async    = ref.watch(journalEntryListProvider);

    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('Journal Entries'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: ErpSearchBar(
              hintText: 'Search journal entries…',
              onChanged: (v) => ref.read(jeSearchProvider.notifier).state = v,
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: List.generate(_statuses.length,
                (i) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(_labels[i]),
                    selected: selected == _statuses[i],
                    onSelected: (_) => ref
                        .read(jeStatusFilterProvider.notifier)
                        .state = _statuses[i],
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(journalEntryListProvider),
              child: async.when(
                loading: () => const LoadingShimmer(),
                error: (e, _) => ErrorState(
                  message: e.toString(),
                  onRetry: () => ref.invalidate(journalEntryListProvider),
                ),
                data: (items) => items.isEmpty
                    ? const EmptyState(
                        message: 'No journal entries found.',
                        icon: Icons.book_outlined,
                      )
                    : NotificationListener<ScrollNotification>(
                        onNotification: (n) {
                          if (n.metrics.pixels >=
                              n.metrics.maxScrollExtent - 200) {
                            ref
                                .read(journalEntryListProvider.notifier)
                                .loadMore();
                          }
                          return false;
                        },
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: items.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (ctx, i) {
                            final je = items[i];
                            return InkWell(
                              onTap: () => context.goNamed(
                                RouteNames.journalEntryDetail,
                                pathParameters: {'id': je.id},
                              ),
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: AppColours.surface,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: AppColours.cardBorder),
                                ),
                                child: Row(children: [
                                  Container(
                                    width: 44, height: 44,
                                    decoration: BoxDecoration(
                                      color: AppColours.primary.withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Icon(Icons.book_outlined,
                                        color: AppColours.primary, size: 22),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(je.docNo,
                                          style: const TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 13)),
                                      const SizedBox(height: 2),
                                      Text(je.description,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                              fontSize: 12,
                                              color: AppColours.textSecondary)),
                                      const SizedBox(height: 4),
                                      Row(children: [
                                        _typeChip(je.journalType),
                                        const SizedBox(width: 6),
                                        Text(FormatUtils.formatDate(
                                            FormatUtils.parseDate(je.docDate)),
                                            style: const TextStyle(
                                                fontSize: 11,
                                                color: AppColours.textHint)),
                                      ]),
                                    ],
                                  )),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      AmountText(je.totalDebit,
                                          style: const TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 13)),
                                      const SizedBox(height: 4),
                                      StatusBadge(status: je.status),
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

  Widget _typeChip(String type) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: AppColours.primary.withOpacity(0.08),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(type,
            style: const TextStyle(
                fontSize: 10,
                color: AppColours.primary,
                fontWeight: FontWeight.w600)),
      );
}
