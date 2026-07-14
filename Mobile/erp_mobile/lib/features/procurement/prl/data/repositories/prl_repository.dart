import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/api/api_client.dart';
import '../../../../../core/api/api_constants.dart';
import '../../../../../core/models/app_exception.dart';
import '../../../../../core/models/paginated_response.dart';
import '../models/prl_models.dart';

final prlRepositoryProvider = Provider<PrlRepository>((ref) {
  return PrlRepository(ref.read(apiClientProvider));
});

class PrlRepository {
  PrlRepository(this._dio);
  final Dio _dio;

  Future<PaginatedResponse<PrlHeader>> fetchList({
    int page = 1,
    int limit = 20,
    String? status,
    String? search,
  }) async {
    try {
      final res = await _dio.get(ApiConstants.prl, queryParameters: {
        'page': page,
        'limit': limit,
        if (status != null && status.isNotEmpty) 'status': status,
        if (search != null && search.isNotEmpty) 'search': search,
      });
      final data = res.data as Map<String, dynamic>;
      return PaginatedResponse<PrlHeader>(
        data: (data['data'] as List<dynamic>)
            .map((e) => PrlHeader.fromJson(e as Map<String, dynamic>))
            .toList(),
        total: data['total'] as int? ?? 0,
        page: data['page'] as int? ?? page,
        limit: data['limit'] as int? ?? limit,
      );
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }

  Future<PrlHeader> fetchById(String id) async {
    try {
      final res = await _dio.get('${ApiConstants.prl}/$id');
      return PrlHeader.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }

  Future<PrlHeader> create(Map<String, dynamic> payload) async {
    try {
      final res = await _dio.post(ApiConstants.prl, data: payload);
      return PrlHeader.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }

  Future<void> submit(String id) async {
    try {
      await _dio.post('${ApiConstants.prl}/$id/submit');
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }

  Future<void> approve(String id, {String? comment}) async {
    try {
      await _dio.post('${ApiConstants.prl}/$id/approve',
          data: comment != null ? {'comment': comment} : null);
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }

  // Sub-section endpoints
  Future<List<DeliverySchedule>> fetchDeliverySchedules(String prlId, String lineId) async {
    try {
      final res = await _dio.get('${ApiConstants.prl}/$prlId/lines/$lineId/delivery-schedules');
      return (res.data as List<dynamic>).map((e) => DeliverySchedule.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }

  Future<List<AccountDetail>> fetchAccountDetails(String prlId, String lineId) async {
    try {
      final res = await _dio.get('${ApiConstants.prl}/$prlId/lines/$lineId/account-details');
      return (res.data as List<dynamic>).map((e) => AccountDetail.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }

  Future<List<AlternateItem>> fetchAlternateItems(String prlId, String lineId) async {
    try {
      final res = await _dio.get('${ApiConstants.prl}/$prlId/lines/$lineId/alternate-items');
      return (res.data as List<dynamic>).map((e) => AlternateItem.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }

  Future<ItemStatus> fetchItemStatus(String prlId, String lineId) async {
    try {
      final res = await _dio.get('${ApiConstants.prl}/$prlId/lines/$lineId/item-status');
      return ItemStatus.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }

  Future<ShortCloseInfo> fetchShortClose(String prlId, String lineId) async {
    try {
      final res = await _dio.get('${ApiConstants.prl}/$prlId/lines/$lineId/short-close');
      return ShortCloseInfo.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }

  Future<LeadTimeInfo> fetchLeadTime(String prlId, String lineId) async {
    try {
      final res = await _dio.get('${ApiConstants.prl}/$prlId/lines/$lineId/lead-time');
      return LeadTimeInfo.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }
}
