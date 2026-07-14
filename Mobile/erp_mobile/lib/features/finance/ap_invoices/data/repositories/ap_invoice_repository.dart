import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/api/api_client.dart';
import '../../../../../core/api/api_constants.dart';
import '../../../../../core/models/paginated_response.dart';
import '../models/ap_invoice_models.dart';

class ApInvoiceRepository {
  ApInvoiceRepository(this._dio);
  final dynamic _dio;

  Future<PaginatedResponse<ApInvoiceSummary>> fetchList({
    int page = 1,
    int limit = 20,
    String? search,
    String? status,
  }) async {
    final resp = await _dio.get(ApiConstants.apInvoices, queryParameters: {
      'page': page,
      'limit': limit,
      if (search != null && search.isNotEmpty) 'search': search,
      if (status != null && status.isNotEmpty) 'status': status,
    });
    return PaginatedResponse.fromJson(
      resp.data as Map<String, dynamic>,
      (json) => ApInvoiceSummary.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<ApInvoice> fetchById(String id) async {
    final resp = await _dio.get('${ApiConstants.apInvoices}/$id');
    return ApInvoice.fromJson(resp.data as Map<String, dynamic>);
  }

  Future<void> approve(String id) async =>
      _dio.post('${ApiConstants.apInvoices}/$id/approve');

  Future<void> post(String id) async =>
      _dio.post('${ApiConstants.apInvoices}/$id/post');

  Future<void> cancel(String id) async =>
      _dio.post('${ApiConstants.apInvoices}/$id/cancel');
}

final apInvoiceRepositoryProvider = Provider<ApInvoiceRepository>(
  (ref) => ApInvoiceRepository(ref.read(apiClientProvider)),
);
