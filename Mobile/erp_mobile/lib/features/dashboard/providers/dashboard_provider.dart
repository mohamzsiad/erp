import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../approvals/data/models/approval_models.dart';
import '../data/models/kpi_data.dart';
import '../data/repositories/dashboard_repository.dart';

final kpiProvider = FutureProvider.autoDispose<KpiData>((ref) {
  return ref.watch(dashboardRepositoryProvider).fetchKpis();
});

final workflowTasksProvider = FutureProvider.autoDispose<List<WorkflowTask>>((ref) {
  return ref.watch(dashboardRepositoryProvider).fetchWorkflowTasks();
});
