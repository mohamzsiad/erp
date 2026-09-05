import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../../../../core/api/api_constants.dart';
import '../../../../core/models/app_exception.dart';
import '../models/sales_models.dart';

final salesRepositoryProvider = Provider<SalesRepository>((ref) {
  return SalesRepository(ref.read(apiClientProvider));
});

class SalesRepository {
  SalesRepository(this._dio);
  final Dio _dio;

  AppException _wrap(DioException e) =>
      e.error is AppException ? e.error! as AppException : AppException(e.message ?? 'Unknown error');

  Future<List<SalesCustomer>> fetchCustomers({String? search}) async {
    try {
      final res = await _dio.get(ApiConstants.salesCustomers, queryParameters: {'limit': 100, if (search != null && search.isNotEmpty) 'search': search});
      return Paged.from(res.data, SalesCustomer.fromJson).data;
    } on DioException catch (e) {
      throw _wrap(e);
    }
  }

  Future<List<SalesDoc>> _fetchDocs(String path, {String? status}) async {
    try {
      final res = await _dio.get(path, queryParameters: {'limit': 100, if (status != null && status != 'ALL') 'status': status});
      return Paged.from(res.data, SalesDoc.fromJson).data;
    } on DioException catch (e) {
      throw _wrap(e);
    }
  }

  Future<List<SalesDoc>> fetchQuotations({String? status}) => _fetchDocs(ApiConstants.salesQuotations, status: status);
  Future<List<SalesDoc>> fetchOrders({String? status}) => _fetchDocs(ApiConstants.salesOrders, status: status);
  Future<List<SalesDoc>> fetchInvoices({String? status}) => _fetchDocs(ApiConstants.salesInvoices, status: status);
}
