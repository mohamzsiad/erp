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
import '../../data/models/prl_models.dart';
import '../../data/repositories/prl_repository.dart';
import '../../providers/prl_provider.dart';
import '../widgets/prl_sub_sections.dart';

class PrlDetailScreen extends ConsumerWidget {
  const PrlDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(prlDetailProvider(id));
    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('PRL Detail'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(prlDetailProvider(id)),
          ),
        ],
      ),
      body: async.when(
        loading: () => const LoadingShimmer(),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(prlDetailProvider(id)),
        ),
        data: (prl) => _PrlDetailTabs(prl: prl),
      ),
    );
  }
}

// ── Tab shell ─────────────────────────────────────────────────────────────────
class _PrlDetailTabs extends ConsumerStatefulWidget {
  const _PrlDetailTabs({required this.prl});
  final PrlHeader prl;

  @override
  ConsumerState<_PrlDetailTabs> createState() => _PrlDetailTabsState();
}

class _PrlDetailTabsState extends ConsumerState<_PrlDetailTabs>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  int _selectedLineIdx = 0;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final prl = widget.prl;
    final canEdit   = ref.read(authProvider.notifier).hasPermission('PROCUREMENT', 'PRL', 'EDIT');
    final canApprove = ref.read(authProvider.notifier).hasPermission('PROCUREMENT', 'PRL', 'APPROVE');

    return Column(
      children: [
        // Tab bar
        Container(
          color: AppColours.primary,
          child: TabBar(
            controller: _tabs,
            indicatorColor: AppColours.surface,
            labelColor: AppColours.surface,
            unselectedLabelColor: Colors.white54,
            tabs: const [
              Tab(text: 'Details'),
              Tab(text: 'Lines'),
              Tab(text: 'Sub-Sections'),
            ],
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _tabs,
            children: [
              // Tab 1: Details
              _DetailsTab(prl: prl, canEdit: canEdit, canApprove: canApprove),
              // Tab 2: Lines
              _LinesTab(
                prl: prl,
                selectedIdx: _selectedLineIdx,
                onLineSelected: (i) {
                  setState(() => _selectedLineIdx = i);
                  _tabs.animateTo(2);
                },
              ),
              // Tab 3: Sub-Sections
              prl.lines.isEmpty
                  ? const Center(child: Text('No lines available.'))
                  : PrlSubSections(
                      prl: prl,
                      lineIndex: _selectedLineIdx.clamp(0, prl.lines.length - 1),
                    ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Details Tab ───────────────────────────────────────────────────────────────
class _DetailsTab extends ConsumerWidget {
  const _DetailsTab({
    required this.prl,
    required this.canEdit,
    required this.canApprove,
  });
  final PrlHeader prl;
  final bool canEdit;
  final bool canApprove;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final totalApprox = prl.lines.fold<double>(
      0, (s, l) => s + l.requestedQty * l.approxPrice,
    );

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(prl.docNo,
                        style: Theme.of(context)
                            .textTheme
                            .headlineSmall
                            ?.copyWith(fontWeight: FontWeight.bold)),
                  ),
                  StatusBadge(status: prl.status),
                ],
              ),
              const SizedBox(height: 12),
              _InfoRow('Doc Date', FormatUtils.formatDate(FormatUtils.parseDate(prl.docDate))),
              if (prl.deliveryDate != null)
                _InfoRow('Delivery Date',
                    FormatUtils.formatDate(FormatUtils.parseDate(prl.deliveryDate))),
              if (prl.locationName != null)
                _InfoRow('Location', prl.locationName!),
              if (prl.chargeCodeName != null)
                _InfoRow('Charge Code', prl.chargeCodeName!),
              if (prl.mrlNo != null)
                _InfoRow('MRL Ref', prl.mrlNo!),
              if (prl.remarks != null && prl.remarks!.isNotEmpty)
                _InfoRow('Remarks', prl.remarks!),
              const Divider(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('${prl.lines.length} line(s)',
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
        const SizedBox(height: 20),
        if (prl.status == 'DRAFT' && canEdit)
          _ActionBtn(
            'Submit for Approval',
            Icons.send_outlined,
            AppColours.statusSubmitted,
            () => _doAction(context, ref, 'submit'),
          ),
        if (prl.status == 'SUBMITTED' && canApprove) ...[
          const SizedBox(height: 8),
          _ActionBtn(
            'Approve',
            Icons.check_circle_outline,
            AppColours.statusApproved,
            () => _doAction(context, ref, 'approve'),
          ),
          const SizedBox(height: 8),
          _ActionBtn(
            'Reject',
            Icons.cancel_outlined,
            AppColours.statusRejected,
            () => _doAction(context, ref, 'reject'),
          ),
        ],
        const SizedBox(height: 24),
      ],
    );
  }

  Future<void> _doAction(BuildContext context, WidgetRef ref, String action) async {
    final title = action == 'submit'
        ? 'Submit PRL'
        : action == 'approve'
            ? 'Approve PRL'
            : 'Reject PRL';
    final ok = await ConfirmDialog.show(
      context,
      title: title,
      message: '$title ${prl.docNo}?',
      confirmLabel: action == 'submit' ? 'Submit' : action == 'approve' ? 'Approve' : 'Reject',
      isDestructive: action == 'reject',
    );
    if (!ok || !context.mounted) return;
    try {
      if (action == 'submit') {
        await ref.read(prlRepositoryProvider).submit(prl.id);
      } else if (action == 'approve') {
        await ref.read(prlRepositoryProvider).approve(prl.id);
      }
      ref.invalidate(prlDetailProvider(prl.id));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('$title successful.'),
          backgroundColor: action == 'reject'
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

// ── Lines Tab ─────────────────────────────────────────────────────────────────
class _LinesTab extends StatelessWidget {
  const _LinesTab({
    required this.prl,
    required this.selectedIdx,
    required this.onLineSelected,
  });
  final PrlHeader prl;
  final int selectedIdx;
  final ValueChanged<int> onLineSelected;

  @override
  Widget build(BuildContext context) {
    if (prl.lines.isEmpty) {
      return const Center(child: Text('No line items.'));
    }
    final total = prl.lines.fold<double>(
      0, (s, l) => s + l.requestedQty * l.approxPrice,
    );

    return Column(
      children: [
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: prl.lines.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (ctx, i) {
              final line = prl.lines[i];
              final isSelected = i == selectedIdx;
              return GestureDetector(
                onTap: () => onLineSelected(i),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? AppColours.primary.withOpacity(0.06)
                        : AppColours.surface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isSelected
                          ? AppColours.primary
                          : AppColours.cardBorder,
                      width: isSelected ? 1.5 : 1,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(line.itemCode,
                              style: TextStyle(
                                fontFamily: 'monospace',
                                fontWeight: FontWeight.bold,
                                color: isSelected
                                    ? AppColours.primary
                                    : AppColours.textPrimary,
                              )),
                          const Spacer(),
                          Text('Tap to view sub-sections →',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    color: AppColours.textHint,
                                    fontSize: 10,
                                  )),
                        ],
                      ),
                      Text(line.itemDescription,
                          style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          _Chip('Qty: ${FormatUtils.formatQty(line.requestedQty)} ${line.uomCode}'),
                          const SizedBox(width: 8),
                          if (line.approxPrice > 0)
                            _Chip(FormatUtils.formatAmount(line.approxPrice)),
                          if (line.shortCloseStatus != 'NONE') ...[
                            const SizedBox(width: 8),
                            StatusBadge(status: line.shortCloseStatus),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        // Summary footer
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: const BoxDecoration(
            color: AppColours.surface,
            border: Border(top: BorderSide(color: AppColours.cardBorder)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Total (${prl.lines.length} lines)',
                  style: Theme.of(context).textTheme.titleSmall),
              AmountText(
                total,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppColours.primary,
                    ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: AppColours.background,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: AppColours.cardBorder),
        ),
        child: Text(text,
            style:
                const TextStyle(fontSize: 11, color: AppColours.textSecondary)),
      );
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

class _ActionBtn extends StatelessWidget {
  const _ActionBtn(this.label, this.icon, this.color, this.onPressed);
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
