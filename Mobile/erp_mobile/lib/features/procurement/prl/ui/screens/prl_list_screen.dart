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
import '../../providers/prl_provider.dart';

class PrlListScreen extends ConsumerWidget {
  const PrlListScreen({super.key});

  static const _statuses = ['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'ENQUIRY_SENT', 'PO_CREATED', 'REJECTED'];
  static const _labels   = ['All', 'Draft', 'Submitted', 'Approved', 'Enquiry Sent', 'PO Created', 'Rejected'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(prlStatusFilterProvider);
    final async    = ref.watch(prlListProvider);

    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('Purchase Requisitions'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => context.goNamed(RouteNames.prlNew),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: ErpSearchBar(
              hintText: 'Search PRL…',
              onChanged: (v) =>
                  ref.read(prlSearchProvider.notifier).state = v,
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
                        .read(prlStatusFilterProvider.notifier)
                        .state = _statuses[i],
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(prlListProvider),
              child: async.when(
                loading: () => const LoadingShimmer(),
                error: (e, _) => ErrorState(
                  message: e.toString(),
                  onRetry: () => ref.invalidate(prlListProvider),
                ),
                data: (items) => items.isEmpty
                    ? const EmptyState(
                        message: 'No purchase requisitions found.',
                        icon: Icons.shopping_cart_outlined,
                      )
                    : NotificationListener<ScrollNotification>(
                        onNotification: (n) {
                          if (n.metrics.pixels >=
                              n.metrics.maxScrollExtent - 200) {
                            ref.read(prlListProvider.notifier).loadMore();
                          }
                          return false;
                        },
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: items.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (ctx, i) {
                            final prl = items[i];
                            final total = prl.lines.fold<double>(
                              0,
                              (s, l) => s + l.requestedQty * l.approxPrice,
                            );
                            return DocumentListTile(
                              docType: 'PRL',
                              docNo: prl.docNo,
                              status: prl.status,
                              subtitle: prl.locationName ?? 'No location',
                              date: FormatUtils.formatDate(
                                  FormatUtils.parseDate(prl.docDate)),
                              amount: total > 0 ? total : null,
                              onTap: () => context.goNamed(
                                RouteNames.prlDetail,
                                pathParameters: {'id': prl.id},
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
