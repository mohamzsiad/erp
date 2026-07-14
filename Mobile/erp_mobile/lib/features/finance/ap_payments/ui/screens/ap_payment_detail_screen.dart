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
import '../../data/models/ap_payment_models.dart';
import '../../data/repositories/ap_payment_repository.dart';
import '../../providers/ap_payment_provider.dart';

class ApPaymentDetailScreen extends ConsumerWidget {
  const ApPaymentDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(apPaymentDetailProvider(id));
    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('AP Payment'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(apPaymentDetailProvider(id)),
          ),
        ],
      ),
      body: async.when(
        loading: () => const LoadingShimmer(),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(apPaymentDetailProvider(id)),
        ),
        data: (pmt) => _ApPaymentBody(pmt: pmt),
      ),
    );
  }
}

class _ApPaymentBody extends ConsumerWidget {
  const _ApPaymentBody({required this.pmt});
  final ApPayment pmt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canPost = ref.read(authProvider.notifier)
        .hasPermission('FINANCE', 'AP_PAYMENT', 'POST');

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _Card(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text(pmt.docNo,
                  style: Theme.of(context).textTheme.headlineSmall
                      ?.copyWith(fontWeight: FontWeight.bold)),
              StatusBadge(status: pmt.status),
            ]),
            const SizedBox(height: 12),
            _InfoRow('Supplier', pmt.supplierName),
            _InfoRow('Doc Date',
                FormatUtils.formatDate(FormatUtils.parseDate(pmt.docDate))),
            _InfoRow('Payment Method', pmt.paymentMethod),
            _InfoRow('Currency',
                '${pmt.currencyCode} (Rate: ${pmt.exchangeRate})'),
            if (pmt.bankAccountName != null)
              _InfoRow('Bank Account', pmt.bankAccountName!),
            if (pmt.chequeNo != null) _InfoRow('Cheque No.', pmt.chequeNo!),
            if (pmt.chequeDate != null)
              _InfoRow('Cheque Date',
                  FormatUtils.formatDate(FormatUtils.parseDate(pmt.chequeDate))),
            if (pmt.remarks != null && pmt.remarks!.isNotEmpty)
              _InfoRow('Remarks', pmt.remarks!),
            const Divider(height: 20),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text('Payment Amount',
                  style: Theme.of(context).textTheme.titleMedium),
              AmountText(pmt.amount,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppColours.statusApproved)),
            ]),
          ],
        )),
        const SizedBox(height: 16),

        if (pmt.allocations.isNotEmpty) ...[
          Text('Invoice Allocations',
              style: Theme.of(context).textTheme.titleLarge
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
                  DataColumn(label: Text('Invoice')),
                  DataColumn(label: Text('Invoice Amt'), numeric: true),
                  DataColumn(label: Text('Allocated'), numeric: true),
                  DataColumn(label: Text('Balance'), numeric: true),
                ],
                rows: pmt.allocations.map((a) => DataRow(cells: [
                  DataCell(Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(a.invoiceDocNo,
                          style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: AppColours.primary,
                              fontSize: 12)),
                      Text(FormatUtils.formatDate(
                          FormatUtils.parseDate(a.invoiceDate)),
                          style: const TextStyle(fontSize: 10)),
                    ],
                  )),
                  DataCell(AmountText(a.invoiceAmount,
                      style: const TextStyle(fontSize: 12))),
                  DataCell(AmountText(a.allocatedAmount,
                      style: const TextStyle(
                          fontSize: 12,
                          color: AppColours.statusApproved))),
                  DataCell(AmountText(a.balanceAfter,
                      style: const TextStyle(fontSize: 12))),
                ])).toList(),
              ),
            ),
          ),
          const SizedBox(height: 20),
        ],

        if (pmt.status == 'DRAFT' && canPost) ...[
          _ActBtn('Post Payment', Icons.check_circle_outline,
              AppColours.statusApproved,
              () => _action(context, ref, 'post')),
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
    final ok = await ConfirmDialog.show(context,
        title: act == 'post' ? 'Post Payment' : 'Cancel Payment',
        message: '${act == 'post' ? 'Post' : 'Cancel'} ${pmt.docNo}?',
        confirmLabel: act == 'post' ? 'Post' : 'Cancel',
        isDestructive: act == 'cancel');
    if (!ok || !context.mounted) return;
    try {
      final repo = ref.read(apPaymentRepositoryProvider);
      if (act == 'post') await repo.post(pmt.id);
      if (act == 'cancel') await repo.cancel(pmt.id);
      ref.invalidate(apPaymentDetailProvider(pmt.id));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content:
              Text('${act == 'post' ? 'Posted' : 'Cancelled'} successfully.'),
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
          SizedBox(width: 110,
              child: Text(label,
                  style: const TextStyle(
                      fontSize: 12, color: AppColours.textSecondary))),
          Expanded(child: Text(value,
              style: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w500))),
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
