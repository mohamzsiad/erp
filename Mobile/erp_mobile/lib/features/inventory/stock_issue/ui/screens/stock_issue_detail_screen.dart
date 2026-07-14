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
import '../../data/models/stock_issue_models.dart';
import '../../data/repositories/stock_issue_repository.dart';
import '../../providers/stock_issue_provider.dart';

class StockIssueDetailScreen extends ConsumerWidget {
  const StockIssueDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(stockIssueDetailProvider(id));
    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('Stock Issue Detail'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(stockIssueDetailProvider(id)),
          ),
        ],
      ),
      body: async.when(
        loading: () => const LoadingShimmer(),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(stockIssueDetailProvider(id)),
        ),
        data: (si) => _SIDetailBody(si: si),
      ),
    );
  }
}

class _SIDetailBody extends ConsumerWidget {
  const _SIDetailBody({required this.si});
  final StockIssueHeader si;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canPost = ref.read(authProvider.notifier)
        .hasPermission('INVENTORY', 'STOCK_ISSUE', 'EDIT');

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _Card(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(si.docNo,
                    style: Theme.of(context).textTheme.headlineSmall
                        ?.copyWith(fontWeight: FontWeight.bold)),
                StatusBadge(status: si.status),
              ],
            ),
            const SizedBox(height: 12),
            _InfoRow('Warehouse', si.warehouseName),
            _InfoRow('Issued To', si.issuedToName),
            _InfoRow('Issue Type', si.issueType),
            _InfoRow('Doc Date',
                FormatUtils.formatDate(FormatUtils.parseDate(si.docDate))),
            if (si.projectName != null) _InfoRow('Project', si.projectName!),
            if (si.chargeCodeName != null)
              _InfoRow('Charge Code', si.chargeCodeName!),
            if (si.remarks != null && si.remarks!.isNotEmpty)
              _InfoRow('Remarks', si.remarks!),
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
                DataColumn(label: Text('Item')),
                DataColumn(label: Text('Req Qty'), numeric: true),
                DataColumn(label: Text('Issued'), numeric: true),
                DataColumn(label: Text('Unit Cost'), numeric: true),
                DataColumn(label: Text('Total'), numeric: true),
              ],
              rows: si.lines.map((l) => DataRow(cells: [
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
                DataCell(Text(FormatUtils.formatQty(l.requestedQty))),
                DataCell(Text(FormatUtils.formatQty(l.issuedQty))),
                DataCell(Text(FormatUtils.formatAmount(l.unitCost,
                    showCurrency: false))),
                DataCell(AmountText(l.totalCost,
                    style: const TextStyle(fontSize: 12))),
              ])).toList(),
            ),
          ),
        ),
        const SizedBox(height: 20),

        if (si.status == 'DRAFT' && canPost) ...[
          _ActBtn('Post Issue', Icons.check_circle_outline,
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
    final ok = await ConfirmDialog.show(
      context,
      title: act == 'post' ? 'Post Stock Issue' : 'Cancel Stock Issue',
      message: '${act == 'post' ? 'Post' : 'Cancel'} ${si.docNo}?',
      confirmLabel: act == 'post' ? 'Post' : 'Cancel',
      isDestructive: act == 'cancel',
    );
    if (!ok || !context.mounted) return;
    try {
      final repo = ref.read(stockIssueRepositoryProvider);
      if (act == 'post') await repo.post(si.id);
      if (act == 'cancel') await repo.cancel(si.id);
      ref.invalidate(stockIssueDetailProvider(si.id));
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
                      fontSize: 12, color: AppColours.textSecondary))),
          Expanded(
              child: Text(value,
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
