import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/api/api_client.dart';
import '../../../../../core/api/api_constants.dart';
import '../../../../../core/models/paginated_response.dart';
import '../models/stock_issue_models.dart';

class StockIssueRepository {
  StockIssueRepository(this._dio);
  final dynamic _dio;

  Future<PaginatedResponse<StockIssueSummary>> fetchList({
    int page = 1,
    int limit = 20,
    String? search,
    String? status,
  }) async {
    final resp = await _dio.get(ApiConstants.stockIssues, queryParameters: {
      'page': page,
      'limit': limit,
      if (search != null && search.isNotEmpty) 'search': search,
      if (status != null && status.isNotEmpty) 'status': status,
    });
    return PaginatedResponse.fromJson(
      resp.data as Map<String, dynamic>,
      (json) => StockIssueSummary.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<StockIssueHeader> fetchById(String id) async {
    final resp = await _dio.get('${ApiConstants.stockIssues}/$id');
    return StockIssueHeader.fromJson(resp.data as Map<String, dynamic>);
  }

  Future<StockIssueHeader> create(Map<String, dynamic> body) async {
    final resp = await _dio.post(ApiConstants.stockIssues, data: body);
    return StockIssueHeader.fromJson(resp.data as Map<String, dynamic>);
  }

  Future<void> post(String id) async =>
      _dio.post('${ApiConstants.stockIssues}/$id/post');

  Future<void> cancel(String id) async =>
      _dio.post('${ApiConstants.stockIssues}/$id/cancel');
}

final stockIssueRepositoryProvider = Provider<StockIssueRepository>(
  (ref) => StockIssueRepository(ref.read(apiClientProvider)),
);
