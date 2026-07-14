import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/api/api_client.dart';
import '../../../../../core/api/api_constants.dart';
import '../../../../../core/models/paginated_response.dart';
import '../models/ap_payment_models.dart';

class ApPaymentRepository {
  ApPaymentRepository(this._dio);
  final dynamic _dio;

  Future<PaginatedResponse<ApPaymentSummary>> fetchList({
    int page = 1,
    int limit = 20,
    String? search,
    String? status,
  }) async {
    final resp = await _dio.get(ApiConstants.apPayments, queryParameters: {
      'page': page,
      'limit': limit,
      if (search != null && search.isNotEmpty) 'search': search,
      if (status != null && status.isNotEmpty) 'status': status,
    });
    return PaginatedResponse.fromJson(
      resp.data as Map<String, dynamic>,
      (json) => ApPaymentSummary.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<ApPayment> fetchById(String id) async {
    final resp = await _dio.get('${ApiConstants.apPayments}/$id');
    return ApPayment.fromJson(resp.data as Map<String, dynamic>);
  }

  Future<void> post(String id) async =>
      _dio.post('${ApiConstants.apPayments}/$id/post');

  Future<void> cancel(String id) async =>
      _dio.post('${ApiConstants.apPayments}/$id/cancel');
}

final apPaymentRepositoryProvider = Provider<ApPaymentRepository>(
  (ref) => ApPaymentRepository(ref.read(apiClientProvider)),
);
