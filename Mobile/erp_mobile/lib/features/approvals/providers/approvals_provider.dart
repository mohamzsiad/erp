import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/approval_models.dart';
import '../data/repositories/approvals_repository.dart';

final selectedDocTypeProvider = StateProvider<String>((ref) => 'ALL');

final approvalsProvider =
    FutureProvider.autoDispose<List<WorkflowTask>>((ref) async {
  final docType = ref.watch(selectedDocTypeProvider);
  return ref
      .watch(approvalsRepositoryProvider)
      .fetchMyTasks(docType: docType);
});

class ApprovalsNotifier extends AsyncNotifier<List<WorkflowTask>> {
  @override
  Future<List<WorkflowTask>> build() async {
    final docType = ref.watch(selectedDocTypeProvider);
    return ref.read(approvalsRepositoryProvider).fetchMyTasks(docType: docType);
  }

  Future<void> submitAction(WorkflowAction action) async {
    await ref.read(approvalsRepositoryProvider).submitAction(action);
    ref.invalidateSelf();
  }
}

final approvalsNotifierProvider =
    AsyncNotifierProvider<ApprovalsNotifier, List<WorkflowTask>>(
        ApprovalsNotifier.new);
