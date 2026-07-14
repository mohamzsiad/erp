import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/api/api_client.dart';
import '../../../../../core/api/api_constants.dart';
import '../../../../../core/models/app_exception.dart';
import '../../../../../core/models/paginated_response.dart';
import '../models/po_models.dart';

final poRepositoryProvider = Provider<PoRepository>((ref) {
  return PoRepository(ref.read(apiClientProvider));
});

class PoRepository {
  PoRepository(this._dio);
  final Dio _dio;

  Future<PaginatedResponse<PoHeader>> fetchList({
    int page = 1,
    int limit = 20,
    String? status,
    String? search,
  }) async {
    try {
      final res = await _dio.get(ApiConstants.po, queryParameters: {
        'page': page,
        'limit': limit,
        if (status != null && status.isNotEmpty) 'status': status,
        if (search != null && search.isNotEmpty) 'search': search,
      });
      final data = res.data as Map<String, dynamic>;
      return PaginatedResponse<PoHeader>(
        data: (data['data'] as List<dynamic>)
            .map((e) => PoHeader.fromJson(e as Map<String, dynamic>))
            .toList(),
        total: data['total'] as int? ?? 0,
        page: data['page'] as int? ?? page,
        limit: data['limit'] as int? ?? limit,
      );
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }

  Future<PoHeader> fetchById(String id) async {
    try {
      final res = await _dio.get('${ApiConstants.po}/$id');
      return PoHeader.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }

  Future<PoHeader> create(Map<String, dynamic> payload) async {
    try {
      final res = await _dio.post(ApiConstants.po, data: payload);
      return PoHeader.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }

  Future<void> submit(String id) async {
    try {
      await _dio.post('${ApiConstants.po}/$id/submit');
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }

  Future<void> approve(String id, {String? comment}) async {
    try {
      await _dio.post('${ApiConstants.po}/$id/approve',
          data: comment != null ? {'comment': comment} : null);
    } on DioException catch (e) {
      throw e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');
    }
  }
}
