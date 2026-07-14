import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../../../../core/api/api_constants.dart';
import '../../../../core/models/app_exception.dart';
import '../models/approval_models.dart';

final approvalsRepositoryProvider = Provider<ApprovalsRepository>((ref) {
  return ApprovalsRepository(ref.read(apiClientProvider));
});

class ApprovalsRepository {
  ApprovalsRepository(this._dio);
  final Dio _dio;

  Future<List<WorkflowTask>> fetchMyTasks({String? docType}) async {
    try {
      final res = await _dio.get(
        ApiConstants.workflowMyTasks,
        queryParameters: docType != null && docType != 'ALL' ? {'docType': docType} : null,
      );
      final list = (res.data as List<dynamic>? ?? []);
      return list.map((e) => WorkflowTask.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }

  Future<void> submitAction(WorkflowAction action) async {
    try {
      await _dio.post(ApiConstants.workflowAction, data: action.toJson());
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }
}
