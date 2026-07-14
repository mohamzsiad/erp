import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/api/api_client.dart';
import '../../../../../core/api/api_constants.dart';
import '../../../../../core/models/paginated_response.dart';
import '../models/grn_models.dart';

class GrnRepository {
  GrnRepository(this._dio);
  final dynamic _dio;

  Future<PaginatedResponse<GrnSummary>> fetchList({
    int page = 1,
    int limit = 20,
    String? search,
    String? status,
  }) async {
    final resp = await _dio.get(ApiConstants.grn, queryParameters: {
      'page': page,
      'limit': limit,
      if (search != null && search.isNotEmpty) 'search': search,
      if (status != null && status.isNotEmpty) 'status': status,
    });
    return PaginatedResponse.fromJson(
      resp.data as Map<String, dynamic>,
      (json) => GrnSummary.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<GrnHeader> fetchById(String id) async {
    final resp = await _dio.get('${ApiConstants.grn}/$id');
    return GrnHeader.fromJson(resp.data as Map<String, dynamic>);
  }

  Future<GrnHeader> create(Map<String, dynamic> body) async {
    final resp = await _dio.post(ApiConstants.grn, data: body);
    return GrnHeader.fromJson(resp.data as Map<String, dynamic>);
  }

  Future<void> post(String id) async =>
      _dio.post('${ApiConstants.grn}/$id/post');

  Future<void> cancel(String id) async =>
      _dio.post('${ApiConstants.grn}/$id/cancel');
}

final grnRepositoryProvider = Provider<GrnRepository>(
  (ref) => GrnRepository(ref.read(apiClientProvider)),
);
