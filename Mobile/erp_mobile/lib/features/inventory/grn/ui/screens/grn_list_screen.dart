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
import '../../providers/grn_provider.dart';

class GrnListScreen extends ConsumerWidget {
  const GrnListScreen({super.key});

  static const _statuses = ['', 'DRAFT', 'POSTED', 'CANCELLED'];
  static const _labels   = ['All', 'Draft', 'Posted', 'Cancelled'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(grnStatusFilterProvider);
    final async    = ref.watch(grnListProvider);

    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('Goods Receipt Notes'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => context.goNamed(RouteNames.grnNew),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: ErpSearchBar(
              hintText: 'Search GRN…',
              onChanged: (v) =>
                  ref.read(grnSearchProvider.notifier).state = v,
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
                        .read(grnStatusFilterProvider.notifier)
                        .state = _statuses[i],
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(grnListProvider),
              child: async.when(
                loading: () => const LoadingShimmer(),
                error: (e, _) => ErrorState(
                  message: e.toString(),
                  onRetry: () => ref.invalidate(grnListProvider),
                ),
                data: (items) => items.isEmpty
                    ? const EmptyState(
                        message: 'No GRNs found.',
                        icon: Icons.local_shipping_outlined,
                      )
                    : NotificationListener<ScrollNotification>(
                        onNotification: (n) {
                          if (n.metrics.pixels >=
                              n.metrics.maxScrollExtent - 200) {
                            ref.read(grnListProvider.notifier).loadMore();
                          }
                          return false;
                        },
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: items.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (ctx, i) {
                            final grn = items[i];
                            return DocumentListTile(
                              docType: 'GRN',
                              docNo: grn.docNo,
                              status: grn.status,
                              subtitle: grn.supplierName,
                              date: FormatUtils.formatDate(
                                  FormatUtils.parseDate(grn.docDate)),
                              amount: grn.totalAmount,
                              onTap: () => context.goNamed(
                                RouteNames.grnDetail,
                                pathParameters: {'id': grn.id},
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
