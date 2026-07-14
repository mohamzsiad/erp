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
import '../../providers/ap_invoice_provider.dart';

class ApInvoiceListScreen extends ConsumerWidget {
  const ApInvoiceListScreen({super.key});

  static const _statuses = ['', 'DRAFT', 'APPROVED', 'POSTED', 'PARTIAL', 'PAID', 'CANCELLED'];
  static const _labels   = ['All', 'Draft', 'Approved', 'Posted', 'Partial', 'Paid', 'Cancelled'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(apInvoiceStatusFilterProvider);
    final async    = ref.watch(apInvoiceListProvider);

    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('AP Invoices'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: ErpSearchBar(
              hintText: 'Search AP invoices…',
              onChanged: (v) =>
                  ref.read(apInvoiceSearchProvider.notifier).state = v,
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: List.generate(
                _statuses.length,
                (i) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(_labels[i]),
                    selected: selected == _statuses[i],
                    onSelected: (_) => ref
                        .read(apInvoiceStatusFilterProvider.notifier)
                        .state = _statuses[i],
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(apInvoiceListProvider),
              child: async.when(
                loading: () => const LoadingShimmer(),
                error: (e, _) => ErrorState(
                  message: e.toString(),
                  onRetry: () => ref.invalidate(apInvoiceListProvider),
                ),
                data: (items) => items.isEmpty
                    ? const EmptyState(
                        message: 'No AP invoices found.',
                        icon: Icons.receipt_long_outlined,
                      )
                    : NotificationListener<ScrollNotification>(
                        onNotification: (n) {
                          if (n.metrics.pixels >=
                              n.metrics.maxScrollExtent - 200) {
                            ref
                                .read(apInvoiceListProvider.notifier)
                                .loadMore();
                          }
                          return false;
                        },
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: items.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (ctx, i) {
                            final inv = items[i];
                            final isOverdue = inv.status != 'PAID' &&
                                inv.status != 'CANCELLED' &&
                                DateTime.tryParse(inv.dueDate)
                                        ?.isBefore(DateTime.now()) ==
                                    true;
                            return InkWell(
                              onTap: () => context.goNamed(
                                RouteNames.apInvoiceDetail,
                                pathParameters: {'id': inv.id},
                              ),
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: AppColours.surface,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: isOverdue
                                        ? AppColours.statusRejected
                                            .withOpacity(0.5)
                                        : AppColours.cardBorder,
                                  ),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(inv.docNo,
                                            style: const TextStyle(
                                                fontWeight: FontWeight.bold,
                                                fontSize: 14)),
                                        StatusBadge(status: inv.status),
                                      ],
                                    ),
                                    const SizedBox(height: 6),
                                    Text(inv.supplierName,
                                        style: const TextStyle(
                                            fontSize: 13,
                                            color: AppColours.textSecondary)),
                                    const SizedBox(height: 8),
                                    Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: [
                                        Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              'Due: ${FormatUtils.formatDate(FormatUtils.parseDate(inv.dueDate))}',
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: isOverdue
                                                    ? AppColours.statusRejected
                                                    : AppColours.textSecondary,
                                                fontWeight: isOverdue
                                                    ? FontWeight.bold
                                                    : null,
                                              ),
                                            ),
                                            if (isOverdue)
                                              const Text('OVERDUE',
                                                  style: TextStyle(
                                                      fontSize: 10,
                                                      color: AppColours
                                                          .statusRejected,
                                                      fontWeight:
                                                          FontWeight.bold)),
                                          ],
                                        ),
                                        Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.end,
                                          children: [
                                            AmountText(inv.totalAmount,
                                                style: const TextStyle(
                                                    fontWeight: FontWeight.bold,
                                                    fontSize: 14)),
                                            if (inv.balanceDue > 0)
                                              Text(
                                                'Due: ${FormatUtils.formatAmount(inv.balanceDue)}',
                                                style: const TextStyle(
                                                    fontSize: 11,
                                                    color: AppColours
                                                        .statusPartial),
                                              ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
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
}
