import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/theme/app_colours.dart';
import '../../../../../core/utils/format_utils.dart';
import '../../../../../core/widgets/error_state.dart';
import '../../../../../core/widgets/loading_shimmer.dart';
import '../../../../../core/widgets/status_badge.dart';
import '../../data/models/prl_models.dart';
import '../../providers/prl_provider.dart';

/// 6-tab sub-section panel for a single PRL line.
class PrlSubSections extends ConsumerStatefulWidget {
  const PrlSubSections({
    super.key,
    required this.prl,
    required this.lineIndex,
  });
  final PrlHeader prl;
  final int lineIndex;

  @override
  ConsumerState<PrlSubSections> createState() => _PrlSubSectionsState();
}

class _PrlSubSectionsState extends ConsumerState<PrlSubSections>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  static const _tabLabels = [
    'Delivery',
    'A/C',
    'Alternates',
    'Status',
    'Short Close',
    'Lead Time',
  ];

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: _tabLabels.length, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final line = widget.prl.lines[widget.lineIndex];
    final args = (prlId: widget.prl.id, lineId: line.id);

    return Column(
      children: [
        // Line indicator
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: AppColours.primary.withOpacity(0.06),
          child: Text(
            'Line ${widget.lineIndex + 1}: ${line.itemCode} — ${line.itemDescription}',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColours.primary,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        // Sub-tab bar
        TabBar(
          controller: _tabs,
          isScrollable: true,
          labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          unselectedLabelStyle: const TextStyle(fontSize: 12),
          tabs: _tabLabels.map((t) => Tab(text: t)).toList(),
          indicatorColor: AppColours.primary,
          labelColor: AppColours.primary,
          unselectedLabelColor: AppColours.textSecondary,
        ),
        Expanded(
          child: TabBarView(
            controller: _tabs,
            children: [
              _DeliveryTab(args: args),
              _AccountTab(args: args),
              _AlternatesTab(args: args),
              _ItemStatusTab(args: args),
              _ShortCloseTab(args: args),
              _LeadTimeTab(args: args),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Delivery Schedule ─────────────────────────────────────────────────────────
class _DeliveryTab extends ConsumerWidget {
  const _DeliveryTab({required this.args});
  final ({String prlId, String lineId}) args;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(deliverySchedulesProvider(args));
    return async.when(
      loading: () => const LoadingShimmer(itemCount: 3),
      error: (e, _) => ErrorState(message: e.toString(),
          onRetry: () => ref.invalidate(deliverySchedulesProvider(args))),
      data: (items) => items.isEmpty
          ? const _Empty('No delivery schedules.')
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final s = items[i];
                return _InfoCard(children: [
                  _Row('Delivery Date',
                      FormatUtils.formatDate(FormatUtils.parseDate(s.deliveryDate))),
                  _Row('Qty', FormatUtils.formatQty(s.qty)),
                  if (s.locationName.isNotEmpty)
                    _Row('Location', s.locationName),
                  if (s.remarks != null && s.remarks!.isNotEmpty)
                    _Row('Remarks', s.remarks!),
                ]);
              },
            ),
    );
  }
}

// ── Account Details ───────────────────────────────────────────────────────────
class _AccountTab extends ConsumerWidget {
  const _AccountTab({required this.args});
  final ({String prlId, String lineId}) args;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(accountDetailsProvider(args));
    return async.when(
      loading: () => const LoadingShimmer(itemCount: 3),
      error: (e, _) => ErrorState(message: e.toString(),
          onRetry: () => ref.invalidate(accountDetailsProvider(args))),
      data: (items) => items.isEmpty
          ? const _Empty('No account details.')
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final a = items[i];
                return _InfoCard(children: [
                  _Row('GL Account', '${a.glAccountCode} — ${a.glAccountName}'),
                  if (a.costCentreName != null)
                    _Row('Cost Centre', a.costCentreName!),
                  _Row('Percentage', '${a.percentage.toStringAsFixed(2)}%'),
                  _Row('Amount', FormatUtils.formatAmount(a.amount)),
                  if (a.budgetYear != null) _Row('Budget Year', a.budgetYear!),
                ]);
              },
            ),
    );
  }
}

// ── Alternate Items ───────────────────────────────────────────────────────────
class _AlternatesTab extends ConsumerWidget {
  const _AlternatesTab({required this.args});
  final ({String prlId, String lineId}) args;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(alternateItemsProvider(args));
    return async.when(
      loading: () => const LoadingShimmer(itemCount: 3),
      error: (e, _) => ErrorState(message: e.toString(),
          onRetry: () => ref.invalidate(alternateItemsProvider(args))),
      data: (items) => items.isEmpty
          ? const _Empty('No alternate items.')
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final a = items[i];
                return _InfoCard(children: [
                  _Row('Item Code', a.itemCode),
                  _Row('Description', a.itemDescription),
                  _Row('Priority', '${a.priority}'),
                  _Row('Approx Price', FormatUtils.formatAmount(a.approxPrice)),
                  _Row('UOM', a.uom),
                  if (a.remarks != null && a.remarks!.isNotEmpty)
                    _Row('Remarks', a.remarks!),
                ]);
              },
            ),
    );
  }
}

// ── Item Status ───────────────────────────────────────────────────────────────
class _ItemStatusTab extends ConsumerWidget {
  const _ItemStatusTab({required this.args});
  final ({String prlId, String lineId}) args;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(itemStatusProvider(args));
    return async.when(
      loading: () => const LoadingShimmer(itemCount: 2),
      error: (e, _) => ErrorState(message: e.toString(),
          onRetry: () => ref.invalidate(itemStatusProvider(args))),
      data: (s) {
        final entries = [
          ('On Hand', s.onHandQty, AppColours.statusApproved),
          ('Reserved', s.reservedQty, AppColours.statusPartial),
          ('Available', s.availableQty, AppColours.statusSubmitted),
          ('On Order', s.onOrderQty, AppColours.statusPosted),
          ('On PO', s.onPOQty, AppColours.primary),
        ];
        return GridView.count(
          padding: const EdgeInsets.all(16),
          crossAxisCount: 2,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: 1.6,
          children: entries
              .map((e) => Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: e.$3.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: e.$3.withOpacity(0.3)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(e.$1,
                            style: TextStyle(
                                fontSize: 11,
                                color: e.$3,
                                fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        Text(
                          FormatUtils.formatQty(e.$2),
                          style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: e.$3),
                        ),
                      ],
                    ),
                  ))
              .toList(),
        );
      },
    );
  }
}

// ── Short Close ───────────────────────────────────────────────────────────────
class _ShortCloseTab extends ConsumerWidget {
  const _ShortCloseTab({required this.args});
  final ({String prlId, String lineId}) args;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(shortCloseProvider(args));
    return async.when(
      loading: () => const LoadingShimmer(itemCount: 2),
      error: (e, _) => ErrorState(message: e.toString(),
          onRetry: () => ref.invalidate(shortCloseProvider(args))),
      data: (s) => SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: _InfoCard(children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                const Text('Status: ',
                    style: TextStyle(color: AppColours.textSecondary,
                        fontSize: 13)),
                StatusBadge(status: s.shortCloseStatus),
              ],
            ),
          ),
          if (s.shortClosedQty != null)
            _Row('Closed Qty', FormatUtils.formatQty(s.shortClosedQty)),
          if (s.shortCloseReason != null && s.shortCloseReason!.isNotEmpty)
            _Row('Reason', s.shortCloseReason!),
          if (s.shortClosedAt != null)
            _Row('Closed At',
                FormatUtils.formatDate(FormatUtils.parseDate(s.shortClosedAt))),
        ]),
      ),
    );
  }
}

// ── Lead Time ─────────────────────────────────────────────────────────────────
class _LeadTimeTab extends ConsumerWidget {
  const _LeadTimeTab({required this.args});
  final ({String prlId, String lineId}) args;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(leadTimeProvider(args));
    return async.when(
      loading: () => const LoadingShimmer(itemCount: 2),
      error: (e, _) => ErrorState(message: e.toString(),
          onRetry: () => ref.invalidate(leadTimeProvider(args))),
      data: (lt) => SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: _InfoCard(children: [
          if (lt.leadTimeDays != null)
            _Row('Lead Time', '${lt.leadTimeDays} days'),
          if (lt.expectedDeliveryDate != null)
            _Row('Expected Delivery',
                FormatUtils.formatDate(
                    FormatUtils.parseDate(lt.expectedDeliveryDate))),
          _Row('Source', lt.leadTimeSource),
        ]),
      ),
    );
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────────
class _Empty extends StatelessWidget {
  const _Empty(this.message);
  final String message;

  @override
  Widget build(BuildContext context) => Center(
        child: Text(message,
            style: const TextStyle(color: AppColours.textHint)),
      );
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColours.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColours.cardBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: children,
        ),
      );
}

class _Row extends StatelessWidget {
  const _Row(this.label, this.value);
  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 110,
              child: Text(label,
                  style: const TextStyle(
                      fontSize: 12, color: AppColours.textSecondary)),
            ),
            Expanded(
              child: Text(value ?? '—',
                  style: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w500)),
            ),
          ],
        ),
      );
}
