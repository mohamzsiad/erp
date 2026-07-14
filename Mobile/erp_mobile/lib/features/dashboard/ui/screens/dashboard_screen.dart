import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/app_colours.dart';
import '../../../../core/utils/format_utils.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/kpi_card.dart';
import '../../../../core/widgets/loading_shimmer.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../../approvals/data/models/approval_models.dart';
import '../../../notifications/providers/notifications_provider.dart';
import '../../data/models/kpi_data.dart';
import '../../providers/dashboard_provider.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final kpiAsync    = ref.watch(kpiProvider);
    final tasksAsync  = ref.watch(workflowTasksProvider);
    final unreadAsync = ref.watch(unreadCountProvider);

    return Scaffold(
      backgroundColor: AppColours.background,
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(kpiProvider);
          ref.invalidate(workflowTasksProvider);
          ref.invalidate(unreadCountProvider);
        },
        child: CustomScrollView(
          slivers: [
            // ── SliverAppBar ────────────────────────────────────────────────
            SliverAppBar(
              pinned: true,
              expandedHeight: 110,
              backgroundColor: AppColours.primary,
              foregroundColor: AppColours.surface,
              flexibleSpace: FlexibleSpaceBar(
                titlePadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                title: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'CloudERP',
                      style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppColours.surface),
                    ),
                    const Text(
                      'Al Wadi Construction LLC',
                      style: TextStyle(
                          fontSize: 11,
                          color: Colors.white70),
                    ),
                  ],
                ),
              ),
              actions: [
                Stack(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.notifications_outlined),
                      onPressed: () => context.go('/notifications'),
                    ),
                    unreadAsync.maybeWhen(
                      data: (count) => count > 0
                          ? Positioned(
                              top: 8,
                              right: 8,
                              child: Container(
                                width: 16,
                                height: 16,
                                decoration: const BoxDecoration(
                                  color: AppColours.statusRejected,
                                  shape: BoxShape.circle,
                                ),
                                child: Center(
                                  child: Text(
                                    count > 99 ? '99+' : '$count',
                                    style: const TextStyle(
                                        fontSize: 9,
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold),
                                  ),
                                ),
                              ),
                            )
                          : const SizedBox.shrink(),
                      orElse: () => const SizedBox.shrink(),
                    ),
                  ],
                ),
                const SizedBox(width: 4),
              ],
            ),

            // ── Body content ─────────────────────────────────────────────────
            SliverToBoxAdapter(
              child: kpiAsync.when(
                loading: () => const LoadingShimmer(itemCount: 6),
                error: (e, _) => ErrorState(
                  message: e.toString(),
                  onRetry: () => ref.invalidate(kpiProvider),
                ),
                data: (kpi) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // My Work
                    _SectionHeader(title: 'My Work', icon: Icons.work_outline),
                    _MyWorkRow(kpi: kpi),

                    // Finance Overview
                    _SectionHeader(
                        title: 'Finance Overview',
                        icon: Icons.account_balance_outlined),
                    _FinanceGrid(kpi: kpi.finance),

                    // Inventory
                    _SectionHeader(
                        title: 'Inventory', icon: Icons.inventory_2_outlined),
                    _InventoryGrid(kpi: kpi.inventory),

                    // Quick Actions
                    _SectionHeader(
                        title: 'Quick Actions', icon: Icons.bolt_outlined),
                    _QuickActionsGrid(),

                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ),

            // ── Pending Approvals ─────────────────────────────────────────────
            SliverToBoxAdapter(
              child: _SectionHeader(
                  title: 'Pending Approvals',
                  icon: Icons.check_circle_outline),
            ),
            tasksAsync.when(
              loading: () => const SliverToBoxAdapter(
                  child: LoadingShimmer(itemCount: 3)),
              error: (e, _) => SliverToBoxAdapter(
                child: ErrorState(
                  message: e.toString(),
                  onRetry: () => ref.invalidate(workflowTasksProvider),
                ),
              ),
              data: (tasks) => tasks.isEmpty
                  ? const SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.symmetric(vertical: 16),
                        child: EmptyState(
                          message: 'No pending approvals.',
                          icon: Icons.check_circle_outline,
                        ),
                      ),
                    )
                  : SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (ctx, i) => Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 4),
                          child: _WorkflowTaskCard(task: tasks[i]),
                        ),
                        childCount: tasks.length,
                      ),
                    ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
    );
  }
}

// ── Section Header ─────────────────────────────────────────────────────────────
class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.icon});
  final String title;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 10),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColours.primary),
          const SizedBox(width: 8),
          Text(title,
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

// ── My Work Row ───────────────────────────────────────────────────────────────
class _MyWorkRow extends ConsumerWidget {
  const _MyWorkRow({required this.kpi});
  final KpiData kpi;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cards = [
      (
        'Pending PRs',
        kpi.procurement.pendingPrCount,
        Icons.assignment_outlined,
        AppColours.kpiBlue,
        AppColours.statusSubmitted,
        '/procurement/prl',
      ),
      (
        'Pending POs',
        kpi.procurement.pendingPoCount,
        Icons.shopping_cart_outlined,
        AppColours.kpiAmber,
        AppColours.statusPartial,
        '/procurement/po',
      ),
      (
        'Pending GRNs',
        kpi.inventory.pendingGrnCount,
        Icons.local_shipping_outlined,
        AppColours.kpiGreen,
        AppColours.statusApproved,
        '/inventory/grn',
      ),
      (
        'AP Invoices',
        kpi.finance.overdueApCount,
        Icons.receipt_outlined,
        AppColours.kpiRed,
        AppColours.statusRejected,
        '/finance/ap/invoices',
      ),
    ];

    return SizedBox(
      height: 110,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        scrollDirection: Axis.horizontal,
        itemCount: cards.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (ctx, i) {
          final c = cards[i];
          return GestureDetector(
            onTap: () => context.go(c.$6),
            child: Container(
              width: 130,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColours.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColours.cardBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(c.$3, size: 22, color: c.$5),
                  const Spacer(),
                  Text(
                    '${c.$2}',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: c.$5,
                        ),
                  ),
                  Text(c.$1,
                      style: Theme.of(context).textTheme.bodySmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

// ── Finance 2x2 Grid ─────────────────────────────────────────────────────────
class _FinanceGrid extends StatelessWidget {
  const _FinanceGrid({required this.kpi});
  final FinanceKpi kpi;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 1.4,
        children: [
          KpiCard(
            title: 'AP Outstanding',
            value: kpi.totalApOutstanding,
            isAmount: true,
            accent: AppColours.kpiRed,
            iconData: Icons.arrow_upward,
            iconColor: AppColours.statusRejected,
          ),
          KpiCard(
            title: 'AR Outstanding',
            value: kpi.totalArOutstanding,
            isAmount: true,
            accent: AppColours.kpiGreen,
            iconData: Icons.arrow_downward,
            iconColor: AppColours.statusApproved,
          ),
          KpiCard(
            title: 'Monthly Revenue',
            value: kpi.monthlyRevenue,
            isAmount: true,
            accent: AppColours.kpiBlue,
            iconData: Icons.trending_up,
            iconColor: AppColours.statusSubmitted,
          ),
          KpiCard(
            title: 'Monthly Expense',
            value: kpi.monthlyExpense,
            isAmount: true,
            accent: AppColours.kpiAmber,
            iconData: Icons.trending_down,
            iconColor: AppColours.statusPartial,
          ),
        ],
      ),
    );
  }
}

// ── Inventory 2x2 Grid ────────────────────────────────────────────────────────
class _InventoryGrid extends StatelessWidget {
  const _InventoryGrid({required this.kpi});
  final InventoryKpi kpi;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 1.4,
        children: [
          KpiCard(
            title: 'Total Stock Value',
            value: kpi.totalStockValue,
            isAmount: true,
            accent: AppColours.kpiBlue,
            iconData: Icons.inventory_2_outlined,
            iconColor: AppColours.primary,
          ),
          KpiCard(
            title: 'Low Stock Items',
            value: kpi.lowStockCount.toDouble(),
            accent: AppColours.kpiRed,
            iconData: Icons.warning_amber_outlined,
            iconColor: AppColours.statusRejected,
          ),
          KpiCard(
            title: 'Pending GRNs',
            value: kpi.pendingGrnCount.toDouble(),
            accent: AppColours.kpiAmber,
            iconData: Icons.local_shipping_outlined,
            iconColor: AppColours.statusPartial,
          ),
          KpiCard(
            title: 'Dead Stock Value',
            value: kpi.deadStockValue,
            isAmount: true,
            accent: AppColours.kpiPurple,
            iconData: Icons.do_not_disturb_outlined,
            iconColor: AppColours.statusPosted,
          ),
        ],
      ),
    );
  }
}

// ── Quick Actions ─────────────────────────────────────────────────────────────
class _QuickActionsGrid extends StatelessWidget {
  const _QuickActionsGrid({super.key});

  @override
  Widget build(BuildContext context) {
    final actions = [
      (Icons.add_shopping_cart, 'New PR', '/procurement/prl/new'),
      (Icons.receipt_long, 'New GRN', '/inventory/grn/new'),
      (Icons.receipt, 'New AP Invoice', '/finance/ap/invoices'),
      (Icons.inventory, 'Check Stock', '/inventory/stock'),
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GridView.count(
        crossAxisCount: 4,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
        childAspectRatio: 0.85,
        children: actions
            .map((a) => GestureDetector(
                  onTap: () => context.go(a.$3),
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColours.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColours.cardBorder),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppColours.kpiBlue,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(a.$1,
                              size: 20, color: AppColours.primary),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          a.$2,
                          style: Theme.of(context).textTheme.labelSmall,
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ))
            .toList(),
      ),
    );
  }
}

// ── Workflow Task Card ────────────────────────────────────────────────────────
class _WorkflowTaskCard extends StatelessWidget {
  const _WorkflowTaskCard({required this.task});
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
      child: Row(
        children: [
          // Doc type badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
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
          const SizedBox(width: 10),
          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  task.docNo,
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                if (task.subject.isNotEmpty)
                  Text(
                    task.subject,
                    style: Theme.of(context).textTheme.bodySmall,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                Text(
                  'By ${task.requestedBy}',
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: AppColours.textHint),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              StatusBadge(status: task.status),
              const SizedBox(height: 4),
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
        ],
      ),
    );
  }
}
