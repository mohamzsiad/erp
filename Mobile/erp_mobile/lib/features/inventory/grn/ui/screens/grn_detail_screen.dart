import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/auth/auth_provider.dart';
import '../../../../../core/theme/app_colours.dart';
import '../../../../../core/utils/format_utils.dart';
import '../../../../../core/widgets/amount_text.dart';
import '../../../../../core/widgets/confirm_dialog.dart';
import '../../../../../core/widgets/error_state.dart';
import '../../../../../core/widgets/loading_shimmer.dart';
import '../../../../../core/widgets/status_badge.dart';
import '../../data/models/grn_models.dart';
import '../../data/repositories/grn_repository.dart';
import '../../providers/grn_provider.dart';

class GrnDetailScreen extends ConsumerWidget {
  const GrnDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(grnDetailProvider(id));
    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('GRN Detail'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(grnDetailProvider(id)),
          ),
        ],
      ),
      body: async.when(
        loading: () => const LoadingShimmer(),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(grnDetailProvider(id)),
        ),
        data: (grn) => _GrnDetailBody(grn: grn),
      ),
    );
  }
}

class _GrnDetailBody extends ConsumerWidget {
  const _GrnDetailBody({required this.grn});
  final GrnHeader grn;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canPost = ref.read(authProvider.notifier)
        .hasPermission('INVENTORY', 'GRN', 'EDIT');

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Header ───────────────────────────────────────────────────────
        _Card(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(grn.docNo,
                    style: Theme.of(context)
                        .textTheme
                        .headlineSmall
                        ?.copyWith(fontWeight: FontWeight.bold)),
                StatusBadge(status: grn.status),
              ],
            ),
            const SizedBox(height: 12),
            _InfoRow('Supplier', grn.supplierName),
            _InfoRow('Doc Date',
                FormatUtils.formatDate(FormatUtils.parseDate(grn.docDate))),
            _InfoRow('Warehouse', grn.warehouseName),
            if (grn.poDocNo != null) _InfoRow('PO Ref.', grn.poDocNo!),
            if (grn.deliveryNoteNo != null)
              _InfoRow('Delivery Note', grn.deliveryNoteNo!),
            if (grn.remarks != null && grn.remarks!.isNotEmpty)
              _InfoRow('Remarks', grn.remarks!),
            const Divider(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Total Amount',
                    style: Theme.of(context).textTheme.titleMedium),
                AmountText(
                  grn.totalAmount,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: AppColours.primary,
                      ),
                ),
              ],
            ),
          ],
        )),
        const SizedBox(height: 16),

        // ── Lines ─────────────────────────────────────────────────────────
        Text('Line Items',
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        _Card(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingRowColor:
                  WidgetStateProperty.all(AppColours.background),
              columnSpacing: 14,
              horizontalMargin: 12,
              headingTextStyle: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: AppColours.textSecondary),
              dataTextStyle: const TextStyle(fontSize: 12),
              columns: const [
                DataColumn(label: Text('Item')),
                DataColumn(label: Text('Ordered'), numeric: true),
                DataColumn(label: Text('Received'), numeric: true),
                DataColumn(label: Text('Accepted'), numeric: true),
                DataColumn(label: Text('Rejected'), numeric: true),
                DataColumn(label: Text('Unit Price'), numeric: true),
              ],
              rows: grn.lines.map((l) => DataRow(cells: [
                DataCell(Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l.itemCode,
                        style: const TextStyle(
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.bold,
                            color: AppColours.primary,
                            fontSize: 12)),
                    Text(l.itemDescription,
                        style: const TextStyle(fontSize: 11),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                  ],
                )),
                DataCell(Text(FormatUtils.formatQty(l.orderedQty))),
                DataCell(Text(FormatUtils.formatQty(l.receivedQty))),
                DataCell(Text(FormatUtils.formatQty(l.acceptedQty))),
                DataCell(Text(
                  FormatUtils.formatQty(l.rejectedQty),
                  style: TextStyle(
                    color: l.rejectedQty > 0
                        ? AppColours.statusRejected
                        : null,
                  ),
                )),
                DataCell(Text(FormatUtils.formatAmount(l.unitPrice,
                    showCurrency: false))),
              ])).toList(),
            ),
          ),
        ),
        const SizedBox(height: 20),

        // ── Actions ───────────────────────────────────────────────────────
        if (grn.status == 'DRAFT' && canPost)
          _ActBtn('Post GRN', Icons.check_circle_outline,
              AppColours.statusApproved,
              () => _action(context, ref, 'post')),
        if (grn.status == 'DRAFT' && canPost) ...[
          const SizedBox(height: 8),
          _ActBtn('Cancel', Icons.cancel_outlined, AppColours.statusRejected,
              () => _action(context, ref, 'cancel')),
        ],
        const SizedBox(height: 24),
      ],
    );
  }

  Future<void> _action(
      BuildContext context, WidgetRef ref, String act) async {
    final ok = await ConfirmDialog.show(
      context,
      title: act == 'post' ? 'Post GRN' : 'Cancel GRN',
      message: '${act == 'post' ? 'Post' : 'Cancel'} ${grn.docNo}?',
      confirmLabel: act == 'post' ? 'Post' : 'Cancel',
      isDestructive: act == 'cancel',
    );
    if (!ok || !context.mounted) return;
    try {
      final repo = ref.read(grnRepositoryProvider);
      if (act == 'post') await repo.post(grn.id);
      if (act == 'cancel') await repo.cancel(grn.id);
      ref.invalidate(grnDetailProvider(grn.id));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('${act == 'post' ? 'Posted' : 'Cancelled'} successfully.'),
          backgroundColor: act == 'post'
              ? AppColours.statusApproved
              : AppColours.statusRejected,
        ));
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString()),
          backgroundColor: AppColours.statusRejected,
        ));
      }
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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
            width: 110,
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

class _ActBtn extends StatelessWidget {
  const _ActBtn(this.label, this.icon, this.color, this.onPressed);
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onPressed;
  @override
  Widget build(BuildContext context) => ElevatedButton.icon(
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          minimumSize: const Size(double.infinity, 48),
        ),
        onPressed: onPressed,
        icon: Icon(icon),
        label: Text(label),
      );
}
