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
import '../../data/models/po_models.dart';
import '../../data/repositories/po_repository.dart';
import '../../providers/po_provider.dart';

class PoDetailScreen extends ConsumerWidget {
  const PoDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(poDetailProvider(id));
    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('PO Detail'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(poDetailProvider(id)),
          ),
        ],
      ),
      body: async.when(
        loading: () => const LoadingShimmer(),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(poDetailProvider(id)),
        ),
        data: (po) => _PoDetailBody(po: po),
      ),
    );
  }
}

class _PoDetailBody extends ConsumerWidget {
  const _PoDetailBody({required this.po});
  final PoHeader po;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canEdit    = ref.read(authProvider.notifier).hasPermission('PROCUREMENT', 'PO', 'EDIT');
    final canApprove = ref.read(authProvider.notifier).hasPermission('PROCUREMENT', 'PO', 'APPROVE');

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Header ──────────────────────────────────────────────────────────
        _Card(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(po.docNo,
                    style: Theme.of(context).textTheme.headlineSmall
                        ?.copyWith(fontWeight: FontWeight.bold)),
                StatusBadge(status: po.status),
              ],
            ),
            const SizedBox(height: 12),
            _InfoRow('Supplier', po.supplierName),
            _InfoRow('Doc Date', FormatUtils.formatDate(FormatUtils.parseDate(po.docDate))),
            if (po.deliveryDate != null)
              _InfoRow('Delivery Date',
                  FormatUtils.formatDate(FormatUtils.parseDate(po.deliveryDate))),
            _InfoRow('Currency', '${po.currencyCode} (Rate: ${po.exchangeRate})'),
            if (po.paymentTerms != null)
              _InfoRow('Payment Terms', po.paymentTerms!),
            if (po.remarks != null && po.remarks!.isNotEmpty)
              _InfoRow('Remarks', po.remarks!),
            const Divider(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Total Amount',
                    style: Theme.of(context).textTheme.titleMedium),
                AmountText(
                  po.totalAmount,
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

        // ── Lines table ──────────────────────────────────────────────────────
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
              columnSpacing: 16,
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
                DataColumn(label: Text('Unit Price'), numeric: true),
                DataColumn(label: Text('Net Amount'), numeric: true),
              ],
              rows: po.lines.map((l) => DataRow(cells: [
                DataCell(
                  Column(
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
                  ),
                ),
                DataCell(Text(FormatUtils.formatQty(l.orderedQty))),
                DataCell(Text(FormatUtils.formatQty(l.receivedQty))),
                DataCell(Text(FormatUtils.formatAmount(l.unitPrice,
                    showCurrency: false))),
                DataCell(Text(FormatUtils.formatAmount(l.netAmount,
                    showCurrency: false))),
              ])).toList(),
            ),
          ),
        ),

        // ── Totals ──────────────────────────────────────────────────────────
        const SizedBox(height: 12),
        _Card(
          child: Column(children: [
            _TotalRow('Subtotal',
                po.lines.fold(0.0, (s, l) => s + l.netAmount)),
            _TotalRow('Total', po.totalAmount, isBold: true),
          ]),
        ),
        const SizedBox(height: 20),

        // ── Actions ──────────────────────────────────────────────────────────
        if (po.status == 'DRAFT' && canEdit)
          _ActBtn('Submit for Approval', Icons.send_outlined,
              AppColours.statusSubmitted,
              () => _action(context, ref, 'submit')),
        if (po.status == 'SUBMITTED' && canApprove) ...[
          const SizedBox(height: 8),
          _ActBtn('Approve', Icons.check_circle_outline,
              AppColours.statusApproved,
              () => _action(context, ref, 'approve')),
          const SizedBox(height: 8),
          _ActBtn('Reject', Icons.cancel_outlined,
              AppColours.statusRejected,
              () => _action(context, ref, 'reject')),
        ],
        if (po.status == 'APPROVED' && canEdit)
          ...[
            const SizedBox(height: 8),
            _ActBtn('Close PO', Icons.lock_outline, AppColours.statusClosed,
                () => _action(context, ref, 'close')),
          ],
        const SizedBox(height: 24),
      ],
    );
  }

  Future<void> _action(BuildContext context, WidgetRef ref, String act) async {
    final labels = {
      'submit': 'Submit',
      'approve': 'Approve',
      'reject': 'Reject',
      'close': 'Close',
    };
    final ok = await ConfirmDialog.show(
      context,
      title: '${labels[act]} PO',
      message: '${labels[act]} ${po.docNo}?',
      confirmLabel: labels[act]!,
      isDestructive: act == 'reject',
    );
    if (!ok || !context.mounted) return;
    try {
      final repo = ref.read(poRepositoryProvider);
      if (act == 'submit') await repo.submit(po.id);
      if (act == 'approve') await repo.approve(po.id);
      ref.invalidate(poDetailProvider(po.id));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('${labels[act]} successful.'),
          backgroundColor: act == 'reject'
              ? AppColours.statusRejected
              : AppColours.statusApproved,
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

class _TotalRow extends StatelessWidget {
  const _TotalRow(this.label, this.amount, {this.isBold = false});
  final String label;
  final double amount;
  final bool isBold;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label,
                style: TextStyle(
                    fontWeight:
                        isBold ? FontWeight.bold : FontWeight.normal,
                    fontSize: isBold ? 15 : 13)),
            AmountText(
              amount,
              style: TextStyle(
                  fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
                  fontSize: isBold ? 15 : 13),
            ),
          ],
        ),
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
