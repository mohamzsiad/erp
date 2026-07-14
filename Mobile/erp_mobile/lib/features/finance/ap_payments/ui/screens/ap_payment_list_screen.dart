import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/router/route_names.dart';
import '../../../../../core/theme/app_colours.dart';
import '../../../../../core/utils/format_utils.dart';
import '../../../../../core/widgets/amount_text.dart';
import '../../../../../core/widgets/empty_state.dart';
import '../../../../../core/widgets/error_state.dart';
import '../../../../../core/widgets/loading_shimmer.dart';
import '../../../../../core/widgets/search_bar_delegate.dart';
import '../../../../../core/widgets/status_badge.dart';
import '../../providers/ap_payment_provider.dart';

class ApPaymentListScreen extends ConsumerWidget {
  const ApPaymentListScreen({super.key});

  static const _statuses = ['', 'DRAFT', 'POSTED', 'CANCELLED'];
  static const _labels   = ['All', 'Draft', 'Posted', 'Cancelled'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(apPaymentStatusFilterProvider);
    final async    = ref.watch(apPaymentListProvider);

    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('AP Payments'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: ErpSearchBar(
              hintText: 'Search AP payments…',
              onChanged: (v) =>
                  ref.read(apPaymentSearchProvider.notifier).state = v,
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: List.generate(_statuses.length,
                (i) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(_labels[i]),
                    selected: selected == _statuses[i],
                    onSelected: (_) => ref
                        .read(apPaymentStatusFilterProvider.notifier)
                        .state = _statuses[i],
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(apPaymentListProvider),
              child: async.when(
                loading: () => const LoadingShimmer(),
                error: (e, _) => ErrorState(
                  message: e.toString(),
                  onRetry: () => ref.invalidate(apPaymentListProvider),
                ),
                data: (items) => items.isEmpty
                    ? const EmptyState(
                        message: 'No AP payments found.',
                        icon: Icons.payments_outlined,
                      )
                    : NotificationListener<ScrollNotification>(
                        onNotification: (n) {
                          if (n.metrics.pixels >=
                              n.metrics.maxScrollExtent - 200) {
                            ref.read(apPaymentListProvider.notifier).loadMore();
                          }
                          return false;
                        },
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: items.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (ctx, i) {
                            final pmt = items[i];
                            return InkWell(
                              onTap: () => context.goNamed(
                                RouteNames.apPaymentDetail,
                                pathParameters: {'id': pmt.id},
                              ),
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: AppColours.surface,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: AppColours.cardBorder),
                                ),
                                child: Row(children: [
                                  Container(
                                    width: 44, height: 44,
                                    decoration: BoxDecoration(
                                      color: AppColours.statusApproved.withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Icon(Icons.payments_outlined,
                                        color: AppColours.statusApproved, size: 22),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(pmt.docNo,
                                          style: const TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 13)),
                                      const SizedBox(height: 2),
                                      Text(pmt.supplierName,
                                          style: const TextStyle(
                                              fontSize: 12,
                                              color: AppColours.textSecondary)),
                                      const SizedBox(height: 4),
                                      Row(children: [
                                        _chip(pmt.paymentMethod),
                                        const SizedBox(width: 6),
                                        Text(FormatUtils.formatDate(
                                            FormatUtils.parseDate(pmt.docDate)),
                                            style: const TextStyle(
                                                fontSize: 11,
                                                color: AppColours.textHint)),
                                      ]),
                                    ],
                                  )),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      AmountText(pmt.amount,
                                          style: const TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 14)),
                                      const SizedBox(height: 4),
                                      StatusBadge(status: pmt.status),
                                    ],
                                  ),
                                ]),
                              ),
                            );
                          },
                        ),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _chip(String label) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: AppColours.background,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: AppColours.cardBorder),
        ),
        child: Text(label,
            style: const TextStyle(
                fontSize: 10, color: AppColours.textSecondary)),
      );
}
