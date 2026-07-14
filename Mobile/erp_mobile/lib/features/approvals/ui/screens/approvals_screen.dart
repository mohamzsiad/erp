import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colours.dart';
import '../../../../core/widgets/confirm_dialog.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/loading_shimmer.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../../../core/utils/format_utils.dart';
import '../../data/models/approval_models.dart';
import '../../providers/approvals_provider.dart';

class ApprovalsScreen extends ConsumerWidget {
  const ApprovalsScreen({super.key});

  static const _tabs = ['ALL', 'PRL', 'PO', 'MRL', 'GRN'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(selectedDocTypeProvider);

    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('Approvals'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(46),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Row(
              children: _tabs
                  .map((t) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(t),
                          selected: selected == t,
                          onSelected: (_) =>
                              ref.read(selectedDocTypeProvider.notifier).state = t,
                          selectedColor: AppColours.surface,
                          backgroundColor:
                              AppColours.primary.withOpacity(0.3),
                          labelStyle: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: selected == t
                                ? AppColours.primary
                                : AppColours.surface,
                          ),
                          side: BorderSide.none,
                        ),
                      ))
                  .toList(),
            ),
          ),
        ),
      ),
      body: Consumer(
        builder: (ctx, ref, _) {
          final async = ref.watch(approvalsNotifierProvider);
          return RefreshIndicator(
            onRefresh: () async =>
                ref.invalidate(approvalsNotifierProvider),
            child: async.when(
              loading: () => const LoadingShimmer(),
              error: (e, _) => ErrorState(
                message: e.toString(),
                onRetry: () => ref.invalidate(approvalsNotifierProvider),
              ),
              data: (tasks) => tasks.isEmpty
                  ? const EmptyState(
                      message: 'No pending approvals.',
                      icon: Icons.check_circle_outline,
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: tasks.length,
                      separatorBuilder: (_, __) =>
                          const SizedBox(height: 8),
                      itemBuilder: (ctx, i) => _SwipeableTaskCard(
                        task: tasks[i],
                        onApprove: () =>
                            _handleAction(ctx, ref, tasks[i], 'APPROVE'),
                        onReject: () =>
                            _showRejectSheet(ctx, ref, tasks[i]),
                      ),
                    ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _handleAction(
    BuildContext context,
    WidgetRef ref,
    WorkflowTask task,
    String action, {
    String? comment,
  }) async {
    final confirmed = await ConfirmDialog.show(
      context,
      title: action == 'APPROVE' ? 'Approve Document' : 'Reject Document',
      message: action == 'APPROVE'
          ? 'Approve ${task.docNo}?'
          : 'Reject ${task.docNo}? This cannot be undone.',
      confirmLabel: action == 'APPROVE' ? 'Approve' : 'Reject',
      isDestructive: action == 'REJECT',
    );
    if (!confirmed || !context.mounted) return;

    try {
      await ref.read(approvalsNotifierProvider.notifier).submitAction(
            WorkflowAction(
              docType: task.docType,
              docId: task.docId,
              action: action,
              comment: comment,
            ),
          );
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${task.docNo} ${action == 'APPROVE' ? 'approved' : 'rejected'} successfully.'),
            backgroundColor: action == 'APPROVE'
                ? AppColours.statusApproved
                : AppColours.statusRejected,
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: AppColours.statusRejected,
          ),
        );
      }
    }
  }

  void _showRejectSheet(
      BuildContext context, WidgetRef ref, WorkflowTask task) {
    final controller = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Reject ${task.docNo}',
                style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 16),
            TextField(
              controller: controller,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'Rejection comment (optional)',
                labelText: 'Comment',
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColours.statusRejected,
                    ),
                    onPressed: () {
                      Navigator.pop(context);
                      _handleAction(context, ref, task, 'REJECT',
                          comment: controller.text.trim().isNotEmpty
                              ? controller.text.trim()
                              : null);
                    },
                    child: const Text('Reject'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Swipeable Task Card ──────────────────────────────────────────────────────
class _SwipeableTaskCard extends StatelessWidget {
  const _SwipeableTaskCard({
    required this.task,
    required this.onApprove,
    required this.onReject,
  });

  final WorkflowTask task;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    return Dismissible(
      key: Key('${task.docType}-${task.docId}'),
      background: _swipeBg(
        color: AppColours.statusApproved,
        icon: Icons.check,
        label: 'Approve',
        alignment: Alignment.centerLeft,
      ),
      secondaryBackground: _swipeBg(
        color: AppColours.statusRejected,
        icon: Icons.close,
        label: 'Reject',
        alignment: Alignment.centerRight,
      ),
      confirmDismiss: (dir) async {
        if (dir == DismissDirection.startToEnd) {
          onApprove();
        } else {
          onReject();
        }
        return false; // Don't auto-dismiss; handled by provider refresh
      },
      child: _TaskCard(task: task),
    );
  }

  Widget _swipeBg({
    required Color color,
    required IconData icon,
    required String label,
    required Alignment alignment,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(12),
      ),
      alignment: alignment,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: Colors.white, size: 26),
          const SizedBox(height: 4),
          Text(label,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _TaskCard extends StatelessWidget {
  const _TaskCard({required this.task});
  final WorkflowTask task;

  @override
  Widget build(BuildContext context) {
    final priorityColor = task.priority == 'high'
        ? AppColours.statusRejected
        : task.priority == 'medium'
            ? AppColours.statusPartial
            : AppColours.textHint;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColours.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColours.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColours.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  task.docType,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: AppColours.primary,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                task.docNo,
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
              const Spacer(),
              StatusBadge(status: task.status),
            ],
          ),
          if (task.subject.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(task.subject,
                style: Theme.of(context).textTheme.bodyMedium,
                maxLines: 2,
                overflow: TextOverflow.ellipsis),
          ],
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(Icons.person_outline,
                  size: 14, color: AppColours.textHint),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  task.requestedBy,
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: AppColours.textHint),
                ),
              ),
              if (task.requestedAt != null)
                Text(
                  FormatUtils.formatDate(
                      FormatUtils.parseDate(task.requestedAt)),
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: AppColours.textHint),
                ),
              const SizedBox(width: 8),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: priorityColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  task.priority.toUpperCase(),
                  style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: priorityColor),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            '← Swipe right to Approve  ·  Swipe left to Reject →',
            style: TextStyle(fontSize: 10, color: AppColours.textHint),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
