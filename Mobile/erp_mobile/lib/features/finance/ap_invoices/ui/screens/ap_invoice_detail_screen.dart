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
import '../../data/models/ap_invoice_models.dart';
import '../../data/repositories/ap_invoice_repository.dart';
import '../../providers/ap_invoice_provider.dart';

class ApInvoiceDetailScreen extends ConsumerWidget {
  const ApInvoiceDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(apInvoiceDetailProvider(id));
    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('AP Invoice'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(apInvoiceDetailProvider(id)),
          ),
        ],
      ),
      body: async.when(
        loading: () => const LoadingShimmer(),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(apInvoiceDetailProvider(id)),
        ),
        data: (inv) => _ApInvoiceBody(inv: inv),
      ),
    );
  }
}

class _ApInvoiceBody extends ConsumerWidget {
  const _ApInvoiceBody({required this.inv});
  final ApInvoice inv;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canApprove = ref.read(authProvider.notifier)
        .hasPermission('FINANCE', 'AP_INVOICE', 'APPROVE');
    final canPost = ref.read(authProvider.notifier)
        .hasPermission('FINANCE', 'AP_INVOICE', 'POST');

    final isOverdue = inv.status != 'PAID' &&
        inv.status != 'CANCELLED' &&
        DateTime.tryParse(inv.dueDate)?.isBefore(DateTime.now()) == true;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _Card(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text(inv.docNo,
                  style: Theme.of(context).textTheme.headlineSmall
                      ?.copyWith(fontWeight: FontWeight.bold)),
              StatusBadge(status: inv.status),
            ]),
            const SizedBox(height: 12),
            _InfoRow('Supplier', inv.supplierName),
            _InfoRow('Doc Date',
                FormatUtils.formatDate(FormatUtils.parseDate(inv.docDate))),
            _InfoRow('Due Date',
                FormatUtils.formatDate(FormatUtils.parseDate(inv.dueDate)),
                valueColor: isOverdue ? AppColours.statusRejected : null),
            _InfoRow('Currency',
                '${inv.currencyCode} (Rate: ${inv.exchangeRate})'),
            if (inv.poDocNo != null) _InfoRow('PO Ref.', inv.poDocNo!),
            if (inv.paymentTerms != null)
              _InfoRow('Payment Terms', inv.paymentTerms!),
            if (inv.remarks != null && inv.remarks!.isNotEmpty)
              _InfoRow('Remarks', inv.remarks!),
            const Divider(height: 20),
            _TotalRow('Subtotal', inv.subtotal),
            _TotalRow('Tax', inv.taxAmount),
            _TotalRow('Total', inv.totalAmount, bold: true),
            if (inv.paidAmount > 0) _TotalRow('Paid', inv.paidAmount),
            if (inv.balanceDue > 0)
              _TotalRow('Balance Due', inv.balanceDue,
                  bold: true,
                  color: isOverdue
                      ? AppColours.statusRejected
                      : AppColours.statusPartial),
          ],
        )),
        const SizedBox(height: 16),

        Text('Line Items',
            style: Theme.of(context).textTheme.titleLarge
                ?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        _Card(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingRowColor: WidgetStateProperty.all(AppColours.background),
              columnSpacing: 14,
              horizontalMargin: 12,
              headingTextStyle: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: AppColours.textSecondary),
              dataTextStyle: const TextStyle(fontSize: 12),
              columns: const [
                DataColumn(label: Text('Description')),
                DataColumn(label: Text('GL Account')),
                DataColumn(label: Text('Qty'), numeric: true),
                DataColumn(label: Text('Unit Price'), numeric: true),
                DataColumn(label: Text('Tax %'), numeric: true),
                DataColumn(label: Text('Net Amount'), numeric: true),
              ],
              rows: inv.lines.map((l) => DataRow(cells: [
                DataCell(Text(l.description, maxLines: 2,
                    overflow: TextOverflow.ellipsis)),
                DataCell(Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l.glAccountCode,
                        style: const TextStyle(
                            fontFamily: 'monospace',
                            color: AppColours.primary,
                            fontSize: 11,
                            fontWeight: FontWeight.bold)),
                    Text(l.glAccountName,
                        style: const TextStyle(fontSize: 10),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                  ],
                )),
                DataCell(Text(FormatUtils.formatQty(l.qty))),
                DataCell(Text(FormatUtils.formatAmount(l.unitPrice,
                    showCurrency: false))),
                DataCell(Text('${l.taxPct.toStringAsFixed(1)}%')),
                DataCell(AmountText(l.netAmount,
                    style: const TextStyle(fontSize: 12))),
              ])).toList(),
            ),
          ),
        ),
        const SizedBox(height: 20),

        if (inv.status == 'DRAFT' && canApprove)
          _ActBtn('Approve Invoice', Icons.check_circle_outline,
              AppColours.statusApproved,
              () => _action(context, ref, 'approve')),
        if (inv.status == 'APPROVED' && canPost) ...[
          const SizedBox(height: 8),
          _ActBtn('Post Invoice', Icons.post_add_outlined,
              AppColours.statusSubmitted,
              () => _action(context, ref, 'post')),
        ],
        if ((inv.status == 'DRAFT' || inv.status == 'APPROVED') && canPost) ...[
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
    final labels = {'approve': 'Approve', 'post': 'Post', 'cancel': 'Cancel'};
    final ok = await ConfirmDialog.show(context,
        title: '${labels[act]} Invoice',
        message: '${labels[act]} ${inv.docNo}?',
        confirmLabel: labels[act]!,
        isDestructive: act == 'cancel');
    if (!ok || !context.mounted) return;
    try {
      final repo = ref.read(apInvoiceRepositoryProvider);
      if (act == 'approve') await repo.approve(inv.id);
      if (act == 'post') await repo.post(inv.id);
      if (act == 'cancel') await repo.cancel(inv.id);
      ref.invalidate(apInvoiceDetailProvider(inv.id));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('${labels[act]} successful.'),
          backgroundColor: act == 'cancel'
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
  const _InfoRow(this.label, this.value, {this.valueColor});
  final String label, value;
  final Color? valueColor;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 110,
              child: Text(label,
                  style: const TextStyle(
                      fontSize: 12, color: AppColours.textSecondary))),
          Expanded(child: Text(value,
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: valueColor))),
        ]),
      );
}

class _TotalRow extends StatelessWidget {
  const _TotalRow(this.label, this.amount,
      {this.bold = false, this.color});
  final String label;
  final double amount;
  final bool bold;
  final Color? color;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label,
                  style: TextStyle(
                      fontWeight: bold ? FontWeight.bold : FontWeight.normal,
                      fontSize: bold ? 15 : 13)),
              AmountText(amount,
                  style: TextStyle(
                      fontWeight: bold ? FontWeight.bold : FontWeight.w500,
                      fontSize: bold ? 15 : 13,
                      color: color)),
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
            minimumSize: const Size(double.infinity, 48)),
        onPressed: onPressed,
        icon: Icon(icon),
        label: Text(label),
      );
}
