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
import '../../providers/item_provider.dart';

class ItemListScreen extends ConsumerWidget {
  const ItemListScreen({super.key});

  static const _types  = ['', 'STOCK', 'NON_STOCK', 'SERVICE', 'ASSET'];
  static const _labels = ['All', 'Stock', 'Non-Stock', 'Service', 'Asset'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(itemTypeFilterProvider);
    final async    = ref.watch(itemListProvider);

    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('Items'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: ErpSearchBar(
              hintText: 'Search items…',
              onChanged: (v) =>
                  ref.read(itemSearchProvider.notifier).state = v,
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: List.generate(
                _types.length,
                (i) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(_labels[i]),
                    selected: selected == _types[i],
                    onSelected: (_) => ref
                        .read(itemTypeFilterProvider.notifier)
                        .state = _types[i],
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(itemListProvider),
              child: async.when(
                loading: () => const LoadingShimmer(),
                error: (e, _) => ErrorState(
                  message: e.toString(),
                  onRetry: () => ref.invalidate(itemListProvider),
                ),
                data: (items) => items.isEmpty
                    ? const EmptyState(
                        message: 'No items found.',
                        icon: Icons.inventory_2_outlined,
                      )
                    : NotificationListener<ScrollNotification>(
                        onNotification: (n) {
                          if (n.metrics.pixels >=
                              n.metrics.maxScrollExtent - 200) {
                            ref.read(itemListProvider.notifier).loadMore();
                          }
                          return false;
                        },
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: items.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (ctx, i) {
                            final item = items[i];
                            return InkWell(
                              onTap: () => context.goNamed(
                                RouteNames.itemDetail,
                                pathParameters: {'id': item.id},
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
                                child: Row(
                                  children: [
                                    Container(
                                      width: 44,
                                      height: 44,
                                      decoration: BoxDecoration(
                                        color: AppColours.primary
                                            .withOpacity(0.1),
                                        borderRadius:
                                            BorderRadius.circular(8),
                                      ),
                                      child: const Icon(
                                          Icons.inventory_2_outlined,
                                          color: AppColours.primary,
                                          size: 22),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(item.itemCode,
                                              style: const TextStyle(
                                                  fontWeight: FontWeight.bold,
                                                  fontFamily: 'monospace',
                                                  fontSize: 13,
                                                  color: AppColours.primary)),
                                          const SizedBox(height: 2),
                                          Text(item.itemDescription,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                  fontSize: 13)),
                                          const SizedBox(height: 4),
                                          Row(children: [
                                            _chip(item.categoryName),
                                            const SizedBox(width: 6),
                                            _chip(item.uomCode),
                                          ]),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          FormatUtils.formatQty(
                                              item.onHandQty),
                                          style: const TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 14,
                                              color: AppColours.primary),
                                        ),
                                        const Text('On Hand',
                                            style: TextStyle(
                                                fontSize: 10,
                                                color:
                                                    AppColours.textSecondary)),
                                        const SizedBox(height: 4),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: item.isActive
                                                ? AppColours.statusApproved
                                                    .withOpacity(0.15)
                                                : AppColours.statusClosed
                                                    .withOpacity(0.15),
                                            borderRadius:
                                                BorderRadius.circular(4),
                                          ),
                                          child: Text(
                                            item.isActive
                                                ? 'Active'
                                                : 'Inactive',
                                            style: TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.w600,
                                                color: item.isActive
                                                    ? AppColours.statusApproved
                                                    : AppColours.statusClosed),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
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

  Widget _chip(String label) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: AppColours.background,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: AppColours.cardBorder),
        ),
        child: Text(label,
            style: const TextStyle(
                fontSize: 10, color: AppColours.textSecondary)),
      );
}
