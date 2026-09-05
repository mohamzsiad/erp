import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colours.dart';
import '../../../../core/widgets/document_list_tile.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/loading_shimmer.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../data/models/sales_models.dart';
import '../../providers/sales_providers.dart';

/// Shared list scaffold for sales document lists (quotations / orders / invoices).
class _SalesDocList extends ConsumerWidget {
  const _SalesDocList({required this.title, required this.provider, required this.docType});

  final String title;
  final ProviderListenable<AsyncValue<List<SalesDoc>>> provider;
  final String docType;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(provider);
    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(title: Text(title), backgroundColor: AppColours.primary, foregroundColor: AppColours.surface),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(provider),
        child: async.when(
          loading: () => const LoadingShimmer(),
          error: (e, _) => ErrorState(message: e.toString(), onRetry: () => ref.invalidate(provider)),
          data: (rows) => rows.isEmpty
              ? const EmptyState(message: 'Nothing here yet.')
              : ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: rows.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final d = rows[i];
                    return DocumentListTile(
                      docNo: d.docNo,
                      status: d.status,
                      subtitle: d.partyName,
                      date: d.date.isNotEmpty ? d.date.substring(0, d.date.length >= 10 ? 10 : d.date.length) : '',
                      amount: d.amount,
                      docType: docType,
                    );
                  },
                ),
        ),
      ),
    );
  }
}

class SalesQuotationsScreen extends StatelessWidget {
  const SalesQuotationsScreen({super.key});
  @override
  Widget build(BuildContext context) => const _SalesDocList(title: 'Quotations', provider: salesQuotationsProvider, docType: 'SQL');
}

class SalesOrdersScreen extends StatelessWidget {
  const SalesOrdersScreen({super.key});
  @override
  Widget build(BuildContext context) => const _SalesDocList(title: 'Sales Orders', provider: salesOrdersProvider, docType: 'SOL');
}

class SalesInvoicesScreen extends StatelessWidget {
  const SalesInvoicesScreen({super.key});
  @override
  Widget build(BuildContext context) => const _SalesDocList(title: 'Sales Invoices', provider: salesInvoicesProvider, docType: 'SVL');
}

class SalesCustomersScreen extends ConsumerWidget {
  const SalesCustomersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(salesCustomersProvider);
    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(title: const Text('Customers'), backgroundColor: AppColours.primary, foregroundColor: AppColours.surface),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(salesCustomersProvider),
        child: async.when(
          loading: () => const LoadingShimmer(),
          error: (e, _) => ErrorState(message: e.toString(), onRetry: () => ref.invalidate(salesCustomersProvider)),
          data: (rows) => rows.isEmpty
              ? const EmptyState(message: 'No customers.')
              : ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: rows.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final c = rows[i];
                    return Card(
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: const BorderSide(color: AppColours.cardBorder)),
                      child: ListTile(
                        title: Text(c.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                        subtitle: Text('${c.code} · ${c.type}', style: const TextStyle(fontSize: 12)),
                        trailing: c.creditHold
                            ? const StatusBadge(status: 'ON HOLD')
                            : StatusBadge(status: c.isActive ? 'ACTIVE' : 'PENDING'),
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}
