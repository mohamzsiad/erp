import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/api/api_client.dart';
import '../../../../../core/api/api_constants.dart';
import '../../../../../core/models/paginated_response.dart';
import '../models/ar_invoice_models.dart';

class ArInvoiceRepository {
  ArInvoiceRepository(this._dio);
  final dynamic _dio;

  Future<PaginatedResponse<ArInvoiceSummary>> fetchList({
    int page = 1, int limit = 20, String? search, String? status,
  }) async {
    final resp = await _dio.get(ApiConstants.arInvoices, queryParameters: {
      'page': page, 'limit': limit,
      if (search != null && search.isNotEmpty) 'search': search,
      if (status != null && status.isNotEmpty) 'status': status,
    });
    return PaginatedResponse.fromJson(
      resp.data as Map<String, dynamic>,
      (json) => ArInvoiceSummary.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<ArInvoice> fetchById(String id) async {
    final resp = await _dio.get('${ApiConstants.arInvoices}/$id');
    return ArInvoice.fromJson(resp.data as Map<String, dynamic>);
  }

  Future<void> approve(String id) async =>
      _dio.post('${ApiConstants.arInvoices}/$id/approve');

  Future<void> post(String id) async =>
      _dio.post('${ApiConstants.arInvoices}/$id/post');

  Future<void> cancel(String id) async =>
      _dio.post('${ApiConstants.arInvoices}/$id/cancel');
}

final arInvoiceRepositoryProvider = Provider<ArInvoiceRepository>(
  (ref) => ArInvoiceRepository(ref.read(apiClientProvider)),
);
