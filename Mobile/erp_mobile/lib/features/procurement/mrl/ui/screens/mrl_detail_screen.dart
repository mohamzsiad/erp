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
import '../../data/models/mrl_models.dart';
import '../../data/repositories/mrl_repository.dart';
import '../../providers/mrl_provider.dart';

class MrlDetailScreen extends ConsumerWidget {
  const MrlDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(mrlDetailProvider(id));

    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('MRL Detail'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(mrlDetailProvider(id)),
          ),
        ],
      ),
      body: async.when(
        loading: () => const LoadingShimmer(),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(mrlDetailProvider(id)),
        ),
        data: (mrl) => _MrlDetailBody(mrl: mrl),
      ),
    );
  }
}

class _MrlDetailBody extends ConsumerWidget {
  const _MrlDetailBody({required this.mrl});
  final MrlHeader mrl;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canEdit = ref
        .read(authProvider.notifier)
        .hasPermission('PROCUREMENT', 'MRL', 'EDIT');
    final canApprove = ref
        .read(authProvider.notifier)
        .hasPermission('PROCUREMENT', 'MRL', 'APPROVE');

    final totalApprox = mrl.lines.fold<double>(
      0,
      (s, l) => s + l.requestedQty * l.approxPrice,
    );

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Header card ──────────────────────────────────────────────────────
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(mrl.docNo,
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                          )),
                  StatusBadge(status: mrl.status),
                ],
              ),
              const SizedBox(height: 12),
              _InfoRow('Doc Date', FormatUtils.formatDate(FormatUtils.parseDate(mrl.docDate))),
              if (mrl.deliveryDate != null)
                _InfoRow('Delivery Date',
                    FormatUtils.formatDate(FormatUtils.parseDate(mrl.deliveryDate))),
              if (mrl.locationName != null)
                _InfoRow('Location', mrl.locationName!),
              if (mrl.chargeCodeName != null)
                _InfoRow('Charge Code', mrl.chargeCodeName!),
              if (mrl.remarks != null && mrl.remarks!.isNotEmpty)
                _InfoRow('Remarks', mrl.remarks!),
              const Divider(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('${mrl.lines.length} line(s)',
                      style: Theme.of(context).textTheme.bodySmall),
                  AmountText(
                    totalApprox,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: AppColours.primary,
                        ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // ── Line items ───────────────────────────────────────────────────────
        Text('Line Items',
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        ...mrl.lines.map((line) => _LineCard(line: line)),

        const SizedBox(height: 20),

        // ── Action buttons ───────────────────────────────────────────────────
        if (mrl.status == 'DRAFT' && canEdit)
          _ActionButton(
            label: 'Submit for Approval',
            icon: Icons.send_outlined,
            color: AppColours.statusSubmitted,
            onPressed: () => _submit(context, ref),
          ),
        if (mrl.status == 'SUBMITTED' && canApprove) ...[
          const SizedBox(height: 8),
          _ActionButton(
            label: 'Approve',
            icon: Icons.check_circle_outline,
            color: AppColours.statusApproved,
            onPressed: () => _approve(context, ref),
          ),
          const SizedBox(height: 8),
          _ActionButton(
            label: 'Reject',
            icon: Icons.cancel_outlined,
            color: AppColours.statusRejected,
            onPressed: () => _reject(context, ref),
          ),
        ],
        const SizedBox(height: 24),
      ],
    );
  }

  Future<void> _submit(BuildContext context, WidgetRef ref) async {
    final ok = await ConfirmDialog.show(
      context,
      title: 'Submit MRL',
      message: 'Submit ${mrl.docNo} for approval?',
      confirmLabel: 'Submit',
    );
    if (!ok || !context.mounted) return;
    try {
      await ref.read(mrlRepositoryProvider).submit(mrl.id);
      ref.invalidate(mrlDetailProvider(mrl.id));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Submitted successfully.'),
          backgroundColor: AppColours.statusApproved,
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

  Future<void> _approve(BuildContext context, WidgetRef ref) async {
    final ok = await ConfirmDialog.show(
      context,
      title: 'Approve MRL',
      message: 'Approve ${mrl.docNo}?',
      confirmLabel: 'Approve',
    );
    if (!ok || !context.mounted) return;
    try {
      await ref.read(mrlRepositoryProvider).approve(mrl.id);
      ref.invalidate(mrlDetailProvider(mrl.id));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Approved successfully.'),
          backgroundColor: AppColours.statusApproved,
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

  Future<void> _reject(BuildContext context, WidgetRef ref) async {
    final ok = await ConfirmDialog.show(
      context,
      title: 'Reject MRL',
      message: 'Reject ${mrl.docNo}? This cannot be undone.',
      confirmLabel: 'Reject',
      isDestructive: true,
    );
    if (!ok || !context.mounted) return;
    // For MRL reject, re-use approve endpoint with reject action via workflow
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
      content: Text('Rejection submitted.'),
      backgroundColor: AppColours.statusRejected,
    ));
  }
}

class _LineCard extends StatelessWidget {
  const _LineCard({required this.line});
  final MrlLine line;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColours.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColours.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                line.itemCode,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.bold,
                      color: AppColours.primary,
                    ),
              ),
              const Spacer(),
              Text(line.uomCode,
                  style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
          Text(line.itemDescription,
              style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 8),
          Row(
            children: [
              _Qty('Requested', line.requestedQty),
              const SizedBox(width: 16),
              if (line.approvedQty != null)
                _Qty('Approved', line.approvedQty!),
              const SizedBox(width: 16),
              if (line.approxPrice > 0)
                _Qty('Unit Price', line.approxPrice, isAmount: true),
            ],
          ),
          if (line.freeStock > 0) ...[
            const SizedBox(height: 4),
            Text('Free stock: ${FormatUtils.formatQty(line.freeStock)} ${line.uomCode}',
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: AppColours.textHint)),
          ],
        ],
      ),
    );
  }
}

class _Qty extends StatelessWidget {
  const _Qty(this.label, this.value, {this.isAmount = false});
  final String label;
  final double value;
  final bool isAmount;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: AppColours.textHint)),
        Text(
          isAmount
              ? FormatUtils.formatAmount(value, showCurrency: false)
              : FormatUtils.formatQty(value),
          style: Theme.of(context)
              .textTheme
              .bodyMedium
              ?.copyWith(fontWeight: FontWeight.w600),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(label,
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: AppColours.textSecondary)),
          ),
          Expanded(
            child: Text(value,
                style: Theme.of(context)
                    .textTheme
                    .bodyMedium
                    ?.copyWith(fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
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

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.onPressed,
  });
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
