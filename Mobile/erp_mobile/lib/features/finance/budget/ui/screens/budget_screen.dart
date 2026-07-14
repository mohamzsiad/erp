import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/theme/app_colours.dart';
import '../../../../../core/utils/format_utils.dart';
import '../../../../../core/widgets/amount_text.dart';
import '../../../../../core/widgets/error_state.dart';
import '../../../../../core/widgets/loading_shimmer.dart';
import '../../data/models/budget_models.dart';
import '../../providers/budget_provider.dart';

class BudgetScreen extends ConsumerWidget {
  const BudgetScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final year  = ref.watch(budgetYearProvider);
    final async = ref.watch(budgetVsActualProvider);

    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('Budget vs Actual'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(budgetVsActualProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Year selector ─────────────────────────────────────────────
          Container(
            color: AppColours.surface,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(
                  icon: const Icon(Icons.chevron_left),
                  onPressed: () => ref
                      .read(budgetYearProvider.notifier)
                      .state = year - 1,
                ),
                Text(
                  year.toString(),
                  style: Theme.of(context).textTheme.titleLarge
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                IconButton(
                  icon: const Icon(Icons.chevron_right),
                  onPressed: year < DateTime.now().year
                      ? () => ref
                          .read(budgetYearProvider.notifier)
                          .state = year + 1
                      : null,
                ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(budgetVsActualProvider),
              child: async.when(
                loading: () => const LoadingShimmer(),
                error: (e, _) => ErrorState(
                  message: e.toString(),
                  onRetry: () => ref.invalidate(budgetVsActualProvider),
                ),
                data: (data) => _BudgetBody(data: data),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BudgetBody extends ConsumerWidget {
  const _BudgetBody({required this.data});
  final BudgetVsActual data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedIdx = ref.watch(budgetSelectedCategoryProvider);
    final displayCategories = data.categories;

    // Build monthly chart data for selected category or overall
    final monthly = selectedIdx != null
        ? displayCategories[selectedIdx].monthly
        : _aggregateMonthly(displayCategories);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Summary Cards ─────────────────────────────────────────────
        Row(children: [
          Expanded(child: _KpiTile('Total Budget', data.totalBudget,
              AppColours.primary)),
          const SizedBox(width: 10),
          Expanded(child: _KpiTile('Total Actual', data.totalActual,
              AppColours.statusSubmitted)),
          const SizedBox(width: 10),
          Expanded(child: _KpiTile(
            'Variance',
            data.totalVariance,
            data.totalVariance >= 0
                ? AppColours.statusApproved
                : AppColours.statusRejected,
          )),
        ]),
        const SizedBox(height: 20),

        // ── Monthly Bar Chart ─────────────────────────────────────────
        Text(
          selectedIdx != null
              ? 'Monthly — ${displayCategories[selectedIdx].categoryName}'
              : 'Monthly — All Categories',
          style: Theme.of(context).textTheme.titleMedium
              ?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        Container(
          height: 240,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColours.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColours.cardBorder),
          ),
          child: monthly.isEmpty
              ? const Center(
                  child: Text('No data',
                      style: TextStyle(color: AppColours.textHint)))
              : BarChart(
                  BarChartData(
                    alignment: BarChartAlignment.spaceAround,
                    maxY: monthly
                            .map((m) =>
                                m.budgetAmount > m.actualAmount
                                    ? m.budgetAmount
                                    : m.actualAmount)
                            .fold(0.0, (a, b) => a > b ? a : b) *
                        1.15,
                    barTouchData: BarTouchData(
                      touchTooltipData: BarTouchTooltipData(
                        getTooltipItem: (group, groupIndex, rod, rodIndex) {
                          final m = monthly[groupIndex];
                          final label =
                              rodIndex == 0 ? 'Budget' : 'Actual';
                          final amt = rodIndex == 0
                              ? m.budgetAmount
                              : m.actualAmount;
                          return BarTooltipItem(
                            '$label\n${FormatUtils.formatAmount(amt)}',
                            const TextStyle(
                                color: Colors.white, fontSize: 11),
                          );
                        },
                      ),
                    ),
                    titlesData: FlTitlesData(
                      show: true,
                      bottomTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          getTitlesWidget: (val, _) => Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Text(
                              monthly[val.toInt()].monthName.substring(0, 3),
                              style: const TextStyle(
                                  fontSize: 10,
                                  color: AppColours.textSecondary),
                            ),
                          ),
                        ),
                      ),
                      leftTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: 52,
                          getTitlesWidget: (val, _) => Text(
                            _shortAmount(val),
                            style: const TextStyle(
                                fontSize: 9,
                                color: AppColours.textSecondary),
                          ),
                        ),
                      ),
                      rightTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false)),
                      topTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false)),
                    ),
                    gridData: FlGridData(
                      drawHorizontalLine: true,
                      getDrawingHorizontalLine: (_) =>
                          const FlLine(color: AppColours.cardBorder, strokeWidth: 1),
                      drawVerticalLine: false,
                    ),
                    borderData: FlBorderData(show: false),
                    barGroups: List.generate(monthly.length, (i) {
                      final m = monthly[i];
                      return BarChartGroupData(
                        x: i,
                        barRods: [
                          BarChartRodData(
                            toY: m.budgetAmount,
                            color: AppColours.primary.withOpacity(0.7),
                            width: 8,
                            borderRadius: const BorderRadius.vertical(
                                top: Radius.circular(4)),
                          ),
                          BarChartRodData(
                            toY: m.actualAmount,
                            color: m.actualAmount <= m.budgetAmount
                                ? AppColours.statusApproved.withOpacity(0.8)
                                : AppColours.statusRejected.withOpacity(0.8),
                            width: 8,
                            borderRadius: const BorderRadius.vertical(
                                top: Radius.circular(4)),
                          ),
                        ],
                      );
                    }),
                  ),
                ),
        ),
        // Legend
        const SizedBox(height: 8),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          _legend('Budget', AppColours.primary.withOpacity(0.7)),
          const SizedBox(width: 20),
          _legend('Actual', AppColours.statusApproved.withOpacity(0.8)),
        ]),
        const SizedBox(height: 24),

        // ── Category Breakdown ────────────────────────────────────────
        Text('Category Breakdown',
            style: Theme.of(context).textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        ...List.generate(displayCategories.length, (i) {
          final cat = displayCategories[i];
          final isSelected = selectedIdx == i;
          final pct = cat.budgetAmount > 0
              ? (cat.actualAmount / cat.budgetAmount).clamp(0.0, 1.5)
              : 0.0;
          return GestureDetector(
            onTap: () => ref
                .read(budgetSelectedCategoryProvider.notifier)
                .state = isSelected ? null : i,
            child: Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColours.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: isSelected
                        ? AppColours.primary
                        : AppColours.cardBorder,
                    width: isSelected ? 1.5 : 1),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(cat.categoryName,
                            style: const TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 13)),
                      ),
                      Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                        AmountText(cat.actualAmount,
                            style: const TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 13)),
                        Text('of ${FormatUtils.formatAmount(cat.budgetAmount)}',
                            style: const TextStyle(
                                fontSize: 11,
                                color: AppColours.textSecondary)),
                      ]),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: pct.clamp(0.0, 1.0),
                      minHeight: 6,
                      backgroundColor: AppColours.background,
                      valueColor: AlwaysStoppedAnimation<Color>(
                          pct > 1.0
                              ? AppColours.statusRejected
                              : pct > 0.85
                                  ? AppColours.statusPartial
                                  : AppColours.statusApproved),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('${(pct * 100).toStringAsFixed(1)}% utilised',
                          style: TextStyle(
                              fontSize: 11,
                              color: pct > 1.0
                                  ? AppColours.statusRejected
                                  : AppColours.textSecondary,
                              fontWeight: pct > 1.0
                                  ? FontWeight.bold
                                  : FontWeight.normal)),
                      Text(
                        'Var: ${cat.variance >= 0 ? '+' : ''}${FormatUtils.formatAmount(cat.variance)}',
                        style: TextStyle(
                            fontSize: 11,
                            color: cat.variance >= 0
                                ? AppColours.statusApproved
                                : AppColours.statusRejected,
                            fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        }),
        const SizedBox(height: 24),
      ],
    );
  }

  List<BudgetMonthly> _aggregateMonthly(List<BudgetCategory> cats) {
    if (cats.isEmpty) return [];
    final monthCount = cats.first.monthly.length;
    return List.generate(monthCount, (i) {
      final first = cats.first.monthly[i];
      double budget = 0, actual = 0;
      for (final cat in cats) {
        if (i < cat.monthly.length) {
          budget += cat.monthly[i].budgetAmount;
          actual += cat.monthly[i].actualAmount;
        }
      }
      return BudgetMonthly(
        month: first.month,
        monthName: first.monthName,
        budgetAmount: budget,
        actualAmount: actual,
        variance: budget - actual,
      );
    });
  }

  String _shortAmount(double v) {
    if (v >= 1000000) return '${(v / 1000000).toStringAsFixed(1)}M';
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(0)}K';
    return v.toStringAsFixed(0);
  }

  Widget _legend(String label, Color color) => Row(children: [
        Container(
            width: 12, height: 12,
            decoration: BoxDecoration(
                color: color, borderRadius: BorderRadius.circular(3))),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontSize: 11)),
      ]);
}

class _KpiTile extends StatelessWidget {
  const _KpiTile(this.label, this.amount, this.color);
  final String label;
  final double amount;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withOpacity(0.25)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: TextStyle(
                    fontSize: 10,
                    color: color,
                    fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            AmountText(amount,
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: color)),
          ],
        ),
      );
}
