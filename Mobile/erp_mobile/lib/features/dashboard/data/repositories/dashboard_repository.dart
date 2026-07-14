import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../../../../core/api/api_constants.dart';
import '../../../../core/models/app_exception.dart';
import '../../../approvals/data/models/approval_models.dart';
import '../models/kpi_data.dart';

final dashboardRepositoryProvider = Provider<DashboardRepository>((ref) {
  return DashboardRepository(ref.read(apiClientProvider));
});

class DashboardRepository {
  DashboardRepository(this._dio);
  final Dio _dio;

  Future<KpiData> fetchKpis() async {
    try {
      final res = await _dio.get(ApiConstants.dashboardKpis);
      return KpiData.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }

  Future<List<WorkflowTask>> fetchWorkflowTasks() async {
    try {
      final res = await _dio.get(ApiConstants.dashboardWorkflowTasks);
      final list = (res.data as List<dynamic>? ?? []);
      return list.map((e) => WorkflowTask.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }
}
