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
import '../../data/models/journal_entry_models.dart';
import '../../data/repositories/journal_entry_repository.dart';
import '../../providers/journal_entry_provider.dart';

class JournalEntryDetailScreen extends ConsumerWidget {
  const JournalEntryDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(journalEntryDetailProvider(id));
    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('Journal Entry'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(journalEntryDetailProvider(id)),
          ),
        ],
      ),
      body: async.when(
        loading: () => const LoadingShimmer(),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(journalEntryDetailProvider(id)),
        ),
        data: (je) => _JeDetailBody(je: je),
      ),
    );
  }
}

class _JeDetailBody extends ConsumerWidget {
  const _JeDetailBody({required this.je});
  final JournalEntry je;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canPost = ref.read(authProvider.notifier)
        .hasPermission('FINANCE', 'JOURNAL', 'POST');
    final canReverse = ref.read(authProvider.notifier)
        .hasPermission('FINANCE', 'JOURNAL', 'REVERSE');

    final isBalanced = (je.totalDebit - je.totalCredit).abs() < 0.001;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Header ───────────────────────────────────────────────────────
        _Card(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text(je.docNo,
                  style: Theme.of(context).textTheme.headlineSmall
                      ?.copyWith(fontWeight: FontWeight.bold)),
              StatusBadge(status: je.status),
            ]),
            const SizedBox(height: 12),
            _InfoRow('Description', je.description),
            _InfoRow('Journal Type', je.journalType),
            _InfoRow('Doc Date',
                FormatUtils.formatDate(FormatUtils.parseDate(je.docDate))),
            _InfoRow('Currency', '${je.currencyCode} (Rate: ${je.exchangeRate})'),
            if (je.reference != null) _InfoRow('Reference', je.reference!),
            if (je.remarks != null && je.remarks!.isNotEmpty)
              _InfoRow('Remarks', je.remarks!),
          ],
        )),
        const SizedBox(height: 16),

        // ── Double-entry table ────────────────────────────────────────────
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Journal Lines',
                style: Theme.of(context).textTheme.titleLarge
                    ?.copyWith(fontWeight: FontWeight.bold)),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: isBalanced
                    ? AppColours.statusApproved.withOpacity(0.15)
                    : AppColours.statusRejected.withOpacity(0.15),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(
                    color: isBalanced
                        ? AppColours.statusApproved.withOpacity(0.4)
                        : AppColours.statusRejected.withOpacity(0.4)),
              ),
              child: Text(
                isBalanced ? '✓ Balanced' : '⚠ Unbalanced',
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: isBalanced
                        ? AppColours.statusApproved
                        : AppColours.statusRejected),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        _Card(
          child: Column(
            children: [
              // Table header
              Container(
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                decoration: BoxDecoration(
                  color: AppColours.background,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(children: [
                  const Expanded(flex: 3, child: Text('Account',
                      style: TextStyle(fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: AppColours.textSecondary))),
                  const Expanded(child: Text('Cost Ctr',
                      style: TextStyle(fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: AppColours.textSecondary))),
                  const SizedBox(
                    width: 90,
                    child: Text('Debit', textAlign: TextAlign.right,
                        style: TextStyle(fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: AppColours.textSecondary)),
                  ),
                  const SizedBox(
                    width: 90,
                    child: Text('Credit', textAlign: TextAlign.right,
                        style: TextStyle(fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: AppColours.textSecondary)),
                  ),
                ]),
              ),
              const Divider(height: 8),
              // Lines
              ...je.lines.map((l) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          flex: 3,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(l.glAccountCode,
                                  style: const TextStyle(
                                      fontFamily: 'monospace',
                                      fontWeight: FontWeight.bold,
                                      color: AppColours.primary,
                                      fontSize: 12)),
                              Text(l.glAccountName,
                                  style: const TextStyle(
                                      fontSize: 11,
                                      color: AppColours.textSecondary),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis),
                              if (l.description != null &&
                                  l.description!.isNotEmpty)
                                Text(l.description!,
                                    style: const TextStyle(
                                        fontSize: 10,
                                        color: AppColours.textHint),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis),
                            ],
                          ),
                        ),
                        Expanded(
                          child: Text(l.costCentreCode ?? '—',
                              style: const TextStyle(
                                  fontSize: 11,
                                  color: AppColours.textSecondary)),
                        ),
                        SizedBox(
                          width: 90,
                          child: l.debitAmount > 0
                              ? AmountText(l.debitAmount,
                                  style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500),
                                  showCurrency: false)
                              : const Text('—',
                                  textAlign: TextAlign.right,
                                  style: TextStyle(
                                      fontSize: 12,
                                      color: AppColours.textHint)),
                        ),
                        SizedBox(
                          width: 90,
                          child: l.creditAmount > 0
                              ? AmountText(l.creditAmount,
                                  style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500),
                                  showCurrency: false)
                              : const Text('—',
                                  textAlign: TextAlign.right,
                                  style: TextStyle(
                                      fontSize: 12,
                                      color: AppColours.textHint)),
                        ),
                      ],
                    ),
                  )),
              const Divider(height: 12),
              // Totals row
              Row(children: [
                const Expanded(flex: 3,
                    child: Text('Totals',
                        style: TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 13))),
                const Expanded(child: SizedBox.shrink()),
                SizedBox(
                  width: 90,
                  child: AmountText(je.totalDebit,
                      style: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.bold),
                      showCurrency: false),
                ),
                SizedBox(
                  width: 90,
                  child: AmountText(je.totalCredit,
                      style: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.bold),
                      showCurrency: false),
                ),
              ]),
            ],
          ),
        ),
        const SizedBox(height: 20),

        if (je.status == 'DRAFT' && canPost)
          _ActBtn('Post Journal Entry', Icons.post_add_outlined,
              AppColours.statusApproved, () => _action(context, ref, 'post')),
        if (je.status == 'POSTED' && canReverse) ...[
          const SizedBox(height: 8),
          _ActBtn('Reverse Entry', Icons.undo_outlined,
              AppColours.statusRejected, () => _action(context, ref, 'reverse')),
        ],
        const SizedBox(height: 24),
      ],
    );
  }

  Future<void> _action(
      BuildContext context, WidgetRef ref, String act) async {
    final ok = await ConfirmDialog.show(context,
        title: act == 'post' ? 'Post Journal Entry' : 'Reverse Entry',
        message: '${act == 'post' ? 'Post' : 'Reverse'} ${je.docNo}?',
        confirmLabel: act == 'post' ? 'Post' : 'Reverse',
        isDestructive: act == 'reverse');
    if (!ok || !context.mounted) return;
    try {
      final repo = ref.read(journalEntryRepositoryProvider);
      if (act == 'post') await repo.post(je.id);
      if (act == 'reverse') await repo.reverse(je.id);
      ref.invalidate(journalEntryDetailProvider(je.id));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content:
              Text('${act == 'post' ? 'Posted' : 'Reversed'} successfully.'),
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
          color: AppColours.surface, borderRadius: BorderRadius.circular(12),
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
  final String label; final IconData icon;
  final Color color; final VoidCallback onPressed;
  @override
  Widget build(BuildContext context) => ElevatedButton.icon(
        style: ElevatedButton.styleFrom(
            backgroundColor: color,
            minimumSize: const Size(double.infinity, 48)),
        onPressed: onPressed,
        icon: Icon(icon), label: Text(label),
      );
}
