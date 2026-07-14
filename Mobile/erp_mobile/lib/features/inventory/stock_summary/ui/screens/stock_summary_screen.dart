import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/theme/app_colours.dart';
import '../../../../../core/utils/format_utils.dart';
import '../../../../../core/widgets/amount_text.dart';
import '../../../../../core/widgets/empty_state.dart';
import '../../../../../core/widgets/error_state.dart';
import '../../../../../core/widgets/loading_shimmer.dart';
import '../../../../../core/widgets/search_bar_delegate.dart';
import '../../data/models/stock_summary_models.dart';
import '../../providers/stock_summary_provider.dart';

class StockSummaryScreen extends ConsumerWidget {
  const StockSummaryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filter = ref.watch(stockSummaryFilterProvider);
    final async  = ref.watch(stockSummaryProvider);

    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('Stock Summary'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(stockSummaryProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Column(
              children: [
                ErpSearchBar(
                  hintText: 'Search items…',
                  onChanged: (v) => ref
                      .read(stockSummaryFilterProvider.notifier)
                      .state = filter.copyWith(search: v),
                ),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(
                    child: FilterChip(
                      label: const Text('Low Stock Only'),
                      selected: filter.lowStockOnly,
                      onSelected: (v) => ref
                          .read(stockSummaryFilterProvider.notifier)
                          .state = filter.copyWith(lowStockOnly: v),
                      selectedColor: AppColours.statusRejected.withOpacity(0.15),
                      checkmarkColor: AppColours.statusRejected,
                      labelStyle: TextStyle(
                          color: filter.lowStockOnly
                              ? AppColours.statusRejected
                              : null),
                    ),
                  ),
                  const SizedBox(width: 8),
                  async.whenOrNull(
                    data: (items) => Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppColours.primary.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${items.length} items',
                        style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColours.primary),
                      ),
                    ),
                  ) ?? const SizedBox.shrink(),
                ]),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(stockSummaryProvider),
              child: async.when(
                loading: () => const LoadingShimmer(),
                error: (e, _) => ErrorState(
                  message: e.toString(),
                  onRetry: () => ref.invalidate(stockSummaryProvider),
                ),
                data: (items) => items.isEmpty
                    ? const EmptyState(
                        message: 'No stock data found.',
                        icon: Icons.inventory_outlined,
                      )
                    : _StockTable(items: items),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StockTable extends StatelessWidget {
  const _StockTable({required this.items});
  final List<StockSummaryItem> items;

  @override
  Widget build(BuildContext context) {
    // Total stock value
    final totalValue = items.fold(0.0, (s, i) => s + i.totalValue);

    return Column(
      children: [
        // Summary banner
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: AppColours.primary.withOpacity(0.08),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColours.primary.withOpacity(0.2)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Total Stock Value',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
              AmountText(
                totalValue,
                style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: AppColours.primary),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                headingRowColor:
                    WidgetStateProperty.all(AppColours.background),
                columnSpacing: 16,
                horizontalMargin: 12,
                headingTextStyle: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: AppColours.textSecondary),
                dataTextStyle: const TextStyle(fontSize: 12),
                columns: const [
                  DataColumn(label: Text('Item')),
                  DataColumn(label: Text('On Hand'), numeric: true),
                  DataColumn(label: Text('Reserved'), numeric: true),
                  DataColumn(label: Text('Available'), numeric: true),
                  DataColumn(label: Text('On Order'), numeric: true),
                  DataColumn(label: Text('Unit Cost'), numeric: true),
                  DataColumn(label: Text('Total Value'), numeric: true),
                ],
                rows: items.map((item) => DataRow(
                  color: WidgetStateProperty.resolveWith((states) {
                    // Highlight low stock in light red
                    if (item.availableQty <= 0) {
                      return AppColours.statusRejected.withOpacity(0.06);
                    }
                    return null;
                  }),
                  cells: [
                    DataCell(Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.itemCode,
                            style: const TextStyle(
                                fontFamily: 'monospace',
                                fontWeight: FontWeight.bold,
                                color: AppColours.primary,
                                fontSize: 12)),
                        Text(item.itemDescription,
                            style: const TextStyle(fontSize: 11),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis),
                        Text(item.categoryName,
                            style: const TextStyle(
                                fontSize: 10,
                                color: AppColours.textHint)),
                      ],
                    )),
                    DataCell(Text(FormatUtils.formatQty(item.onHandQty))),
                    DataCell(Text(FormatUtils.formatQty(item.reservedQty))),
                    DataCell(Text(
                      FormatUtils.formatQty(item.availableQty),
                      style: TextStyle(
                        color: item.availableQty <= 0
                            ? AppColours.statusRejected
                            : null,
                        fontWeight: item.availableQty <= 0
                            ? FontWeight.bold
                            : null,
                      ),
                    )),
                    DataCell(Text(FormatUtils.formatQty(item.onOrderQty))),
                    DataCell(Text(FormatUtils.formatAmount(item.unitCost,
                        showCurrency: false))),
                    DataCell(AmountText(item.totalValue,
                        style: const TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w600))),
                  ],
                )).toList(),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
