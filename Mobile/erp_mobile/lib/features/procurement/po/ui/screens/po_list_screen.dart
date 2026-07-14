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
import '../../providers/po_provider.dart';

class PoListScreen extends ConsumerWidget {
  const PoListScreen({super.key});

  static const _statuses = ['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIAL', 'RECEIVED', 'INVOICED', 'CLOSED', 'CANCELLED'];
  static const _labels   = ['All', 'Draft', 'Submitted', 'Approved', 'Partial', 'Received', 'Invoiced', 'Closed', 'Cancelled'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(poStatusFilterProvider);
    final async    = ref.watch(poListProvider);

    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('Purchase Orders'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => context.goNamed(RouteNames.poNew),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: ErpSearchBar(
              hintText: 'Search PO…',
              onChanged: (v) =>
                  ref.read(poSearchProvider.notifier).state = v,
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
                        .read(poStatusFilterProvider.notifier)
                        .state = _statuses[i],
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(poListProvider),
              child: async.when(
                loading: () => const LoadingShimmer(),
                error: (e, _) => ErrorState(
                  message: e.toString(),
                  onRetry: () => ref.invalidate(poListProvider),
                ),
                data: (items) => items.isEmpty
                    ? const EmptyState(
                        message: 'No purchase orders found.',
                        icon: Icons.shopping_cart_outlined,
                      )
                    : NotificationListener<ScrollNotification>(
                        onNotification: (n) {
                          if (n.metrics.pixels >=
                              n.metrics.maxScrollExtent - 200) {
                            ref.read(poListProvider.notifier).loadMore();
                          }
                          return false;
                        },
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: items.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (ctx, i) {
                            final po = items[i];
                            return DocumentListTile(
                              docType: 'PO',
                              docNo: po.docNo,
                              status: po.status,
                              subtitle: po.supplierName.isNotEmpty
                                  ? po.supplierName
                                  : 'No supplier',
                              date: FormatUtils.formatDate(
                                  FormatUtils.parseDate(po.docDate)),
                              amount: po.totalAmount,
                              onTap: () => context.goNamed(
                                RouteNames.poDetail,
                                pathParameters: {'id': po.id},
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
