import 'package:freezed_annotation/freezed_annotation.dart';

part 'approval_models.freezed.dart';
part 'approval_models.g.dart';

@freezed
class WorkflowTask with _$WorkflowTask {
  const factory WorkflowTask({
    required String docType,
    required String docId,
    required String docNo,
    @Default('') String subject,
    @Default('') String requestedBy,
    String? requestedAt,
    @Default('SUBMITTED') String status,
    @Default('normal') String priority,
  }) = _WorkflowTask;

  factory WorkflowTask.fromJson(Map<String, dynamic> json) =>
      _$WorkflowTaskFromJson(json);
}

@freezed
class WorkflowAction with _$WorkflowAction {
  const factory WorkflowAction({
    required String docType,
    required String docId,
    required String action,  // 'APPROVE' | 'REJECT'
    String? comment,
  }) = _WorkflowAction;

  factory WorkflowAction.fromJson(Map<String, dynamic> json) =>
      _$WorkflowActionFromJson(json);

  Map<String, dynamic> toJson() => _$WorkflowActionToJson(this);
}
