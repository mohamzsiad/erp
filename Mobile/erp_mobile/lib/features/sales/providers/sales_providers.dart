import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/sales_models.dart';
import '../data/repositories/sales_repository.dart';

final salesCustomersProvider = FutureProvider.autoDispose<List<SalesCustomer>>((ref) async {
  return ref.watch(salesRepositoryProvider).fetchCustomers();
});

final salesQuotationsProvider = FutureProvider.autoDispose<List<SalesDoc>>((ref) async {
  return ref.watch(salesRepositoryProvider).fetchQuotations();
});

final salesOrdersProvider = FutureProvider.autoDispose<List<SalesDoc>>((ref) async {
  return ref.watch(salesRepositoryProvider).fetchOrders();
});

final salesInvoicesProvider = FutureProvider.autoDispose<List<SalesDoc>>((ref) async {
  return ref.watch(salesRepositoryProvider).fetchInvoices();
});
