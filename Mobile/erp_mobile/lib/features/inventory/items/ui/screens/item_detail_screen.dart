import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/theme/app_colours.dart';
import '../../../../../core/utils/format_utils.dart';
import '../../../../../core/widgets/amount_text.dart';
import '../../../../../core/widgets/error_state.dart';
import '../../../../../core/widgets/loading_shimmer.dart';
import '../../providers/item_provider.dart';

class ItemDetailScreen extends ConsumerWidget {
  const ItemDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(itemDetailProvider(id));
    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('Item Detail'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(itemDetailProvider(id)),
          ),
        ],
      ),
      body: async.when(
        loading: () => const LoadingShimmer(),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(itemDetailProvider(id)),
        ),
        data: (item) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── Identity ──────────────────────────────────────────────────
            _Card(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.itemCode,
                              style: Theme.of(context)
                                  .textTheme
                                  .headlineSmall
                                  ?.copyWith(
                                      fontWeight: FontWeight.bold,
                                      fontFamily: 'monospace',
                                      color: AppColours.primary)),
                          const SizedBox(height: 4),
                          Text(item.itemDescription,
                              style: Theme.of(context).textTheme.titleMedium),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: item.isActive
                            ? AppColours.statusApproved.withOpacity(0.15)
                            : AppColours.statusClosed.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                            color: item.isActive
                                ? AppColours.statusApproved.withOpacity(0.4)
                                : AppColours.statusClosed.withOpacity(0.4)),
                      ),
                      child: Text(
                        item.isActive ? 'Active' : 'Inactive',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: item.isActive
                                ? AppColours.statusApproved
                                : AppColours.statusClosed),
                      ),
                    ),
                  ],
                ),
                const Divider(height: 20),
                _InfoRow('Category', item.categoryName),
                _InfoRow('Item Type', item.itemType),
                _InfoRow('UOM', item.uomCode),
                if (item.barcode != null) _InfoRow('Barcode', item.barcode!),
                if (item.manufacturer != null)
                  _InfoRow('Manufacturer', item.manufacturer!),
                if (item.manufacturerPartNo != null)
                  _InfoRow('Mfr. Part No.', item.manufacturerPartNo!),
                if (item.remarks != null && item.remarks!.isNotEmpty)
                  _InfoRow('Remarks', item.remarks!),
              ],
            )),
            const SizedBox(height: 16),

            // ── Stock Levels ──────────────────────────────────────────────
            Text('Stock Levels',
                style: Theme.of(context)
                    .textTheme
                    .titleLarge
                    ?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 1.6,
              children: [
                _StockCard('On Hand', item.onHandQty, AppColours.statusApproved),
                _StockCard('Reserved', item.reservedQty, AppColours.statusPartial),
                _StockCard('Available', item.availableQty, AppColours.statusSubmitted),
                _StockCard('On Order', item.onOrderQty, AppColours.primary),
              ],
            ),
            const SizedBox(height: 16),

            // ── Costs ─────────────────────────────────────────────────────
            Text('Cost Information',
                style: Theme.of(context)
                    .textTheme
                    .titleLarge
                    ?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            _Card(child: Column(children: [
              _AmtRow('Standard Cost', item.standardCost),
              _AmtRow('Current Cost', item.currentCost),
            ])),
            const SizedBox(height: 16),

            // ── Reorder ───────────────────────────────────────────────────
            if (item.minStockLevel != null ||
                item.reorderPoint != null) ...[
              Text('Reorder Settings',
                  style: Theme.of(context)
                      .textTheme
                      .titleLarge
                      ?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              _Card(child: Column(children: [
                if (item.minStockLevel != null)
                  _QtyRow('Min Stock Level',
                      item.minStockLevel!),
                if (item.maxStockLevel != null)
                  _QtyRow('Max Stock Level',
                      item.maxStockLevel!),
                if (item.reorderPoint != null)
                  _QtyRow('Reorder Point', item.reorderPoint!),
                if (item.reorderQty != null)
                  _QtyRow('Reorder Qty', item.reorderQty!),
              ])),
            ],
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class _StockCard extends StatelessWidget {
  const _StockCard(this.label, this.qty, this.color);
  final String label;
  final double qty;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(label,
                style: TextStyle(
                    fontSize: 11,
                    color: color,
                    fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(FormatUtils.formatQty(qty),
                style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: color)),
          ],
        ),
      );
}

// ── Shared helpers ────────────────────────────────────────────────────────────
class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColours.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColours.cardBorder),
        ),
        child: child,
      );
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(this.label, this.value);
  final String label, value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(
            width: 120,
            child: Text(label,
                style: const TextStyle(
                    fontSize: 12, color: AppColours.textSecondary)),
          ),
          Expanded(
            child: Text(value,
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w500)),
          ),
        ]),
      );
}

class _AmtRow extends StatelessWidget {
  const _AmtRow(this.label, this.amount);
  final String label;
  final double amount;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label,
                style: const TextStyle(
                    fontSize: 13, color: AppColours.textSecondary)),
            AmountText(amount,
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w600)),
          ],
        ),
      );
}

class _QtyRow extends StatelessWidget {
  const _QtyRow(this.label, this.qty);
  final String label;
  final double qty;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label,
                style: const TextStyle(
                    fontSize: 13, color: AppColours.textSecondary)),
            Text(FormatUtils.formatQty(qty),
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w600)),
          ],
        ),
      );
}
