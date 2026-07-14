import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../../../../core/api/api_constants.dart';
import '../../../../core/models/app_exception.dart';
import '../../../../core/models/paginated_response.dart';
import '../models/notification_model.dart';

final notificationsRepositoryProvider = Provider<NotificationsRepository>((ref) {
  return NotificationsRepository(ref.read(apiClientProvider));
});

class NotificationsRepository {
  NotificationsRepository(this._dio);
  final Dio _dio;

  Future<int> fetchUnreadCount() async {
    try {
      final res = await _dio.get(ApiConstants.notificationsUnreadCount);
      return (res.data['count'] as int?) ?? 0;
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }

  Future<PaginatedResponse<ErpNotification>> fetchList({
    int page = 1,
    int limit = 20,
    bool unreadOnly = false,
  }) async {
    try {
      final res = await _dio.get(ApiConstants.notifications, queryParameters: {
        'page': page,
        'limit': limit,
        'unread': unreadOnly,
      });
      final data = res.data as Map<String, dynamic>;
      return PaginatedResponse<ErpNotification>(
        data: (data['data'] as List<dynamic>)
            .map((e) => ErpNotification.fromJson(e as Map<String, dynamic>))
            .toList(),
        total: data['total'] as int? ?? 0,
        page: data['page'] as int? ?? page,
        limit: data['limit'] as int? ?? limit,
      );
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }

  Future<void> markRead(String id) async {
    try {
      await _dio.patch('${ApiConstants.notifications}/$id/read');
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }

  Future<void> markAllRead() async {
    try {
      await _dio.patch(ApiConstants.notificationsMarkAllRead);
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }
}
